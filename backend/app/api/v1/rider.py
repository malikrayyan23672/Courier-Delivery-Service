from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.rider import RiderProfile, RiderStatus
from app.models.order import Order, OrderStatus
from app.models.delivery_attempt import DeliveryAttempt
from app.schemas.order import OrderOut
from app.utils.uploads import save_pod_photo
from app.services import otp_service
from app.services.settlement_service import (
    create_cod_settlement,
    WALLET_LOCK_THRESHOLD,
    WALLET_WARNING_THRESHOLD,
)
from app.services.order_service import transition
from app.schemas.rider import (
    RiderMeOut,
    RiderStatsOut,
    AvailabilityUpdate,
    AvailabilityOut,
    OfferResponse,
    LocationUpdate,
    DeliveryOtpOut,
)

router = APIRouter(prefix="/rider", tags=["Rider"])

ACTIVE_STATUSES = (
    OrderStatus.assigned,
    OrderStatus.picked_up,
    OrderStatus.in_hub,
    OrderStatus.in_transit,
    OrderStatus.dest_hub,
    OrderStatus.out_for_delivery,
)
# Statuses a rider is allowed to set directly via the generic status endpoint.
# `in_hub`/`in_transit`/`dest_hub` only ever happen via hub/manifest scans;
# `delivered` requires the dedicated OTP+photo+GPS proof-of-delivery endpoint.
RIDER_SETTABLE_STATUSES = (OrderStatus.picked_up, OrderStatus.out_for_delivery, OrderStatus.failed)


def _rider_profile(db: Session, current_user: User) -> RiderProfile:
    rider_profile = current_user.rider_profile
    if not rider_profile:
        # A "rider" role account should always have a profile row. If one's missing
        # (onboarded through a path that didn't create it, a legacy account, etc.),
        # create a safe default here instead of leaving the rider stuck looking at a
        # broken dashboard. Starts pending_verification and unavailable/uncovered on
        # purpose - going online (see update_availability) is what activates it.
        rider_profile = RiderProfile(user_id=current_user.id)
        db.add(rider_profile)
        db.commit()
        db.refresh(rider_profile)
        current_user.rider_profile = rider_profile
    return rider_profile


@router.get("/me", response_model=RiderMeOut)
def my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(db, current_user)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    base_query = db.query(Order).filter(Order.rider_id == rider_profile.id)

    deliveries_today = base_query.filter(
        Order.status == OrderStatus.delivered,
        Order.created_at >= today_start,
    ).count()

    active_deliveries = base_query.filter(
        Order.status.in_(ACTIVE_STATUSES),
        (Order.status != OrderStatus.assigned) | (Order.rider_accepted == True),  # noqa: E712
    ).count()

    earnings_today = base_query.filter(
        Order.status == OrderStatus.delivered,
        Order.created_at >= today_start,
    ).with_entities(func.sum(Order.final_price)).scalar() or 0.0

    return RiderMeOut(
        full_name=current_user.full_name,
        vehicle_type=rider_profile.vehicle_type,
        status=rider_profile.status.value,
        is_available=rider_profile.is_available,
        rating=rider_profile.rating,
        stats=RiderStatsOut(
            deliveries_today=deliveries_today,
            active_deliveries=active_deliveries,
            earnings_today=round(earnings_today, 2),
        ),
        cod_cash_held=rider_profile.cod_cash_held or 0.0,
        cod_wallet_locked=rider_profile.cod_wallet_locked or False,
        cod_wallet_limit=WALLET_LOCK_THRESHOLD,
        cod_wallet_warning_at=WALLET_WARNING_THRESHOLD,
    )


@router.patch("/availability", response_model=AvailabilityOut)
def update_availability(
    payload: AvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(db, current_user)

    # Going online for the first time activates a pending rider automatically -
    # no separate admin approval step required. Only pending_verification promotes
    # this way; a suspended/inactive rider does NOT get reactivated just by
    # flipping their own toggle - that still requires an admin.
    if payload.is_available and rider_profile.status == RiderStatus.pending_verification:
        rider_profile.status = RiderStatus.active

    rider_profile.is_available = payload.is_available
    db.commit()
    return AvailabilityOut(is_available=rider_profile.is_available)


@router.patch("/location", response_model=LocationUpdate)
def update_location(
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    """Riders ping this while online so customers can see roughly where their package is.
    Intentionally cheap - no joins, no delivery list touched - so the frontend can call
    this frequently in the background without it affecting anything else on the page."""
    rider_profile = _rider_profile(db, current_user)
    rider_profile.current_lat = payload.lat
    rider_profile.current_lng = payload.lng
    db.commit()
    return payload


@router.get("/deliveries", response_model=list[OrderOut])
def my_deliveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(db, current_user)

    return (
        db.query(Order)
        .options(joinedload(Order.pickup_address), joinedload(Order.dropoff_address))
        .filter(Order.rider_id == rider_profile.id)
        .order_by(Order.created_at.desc())
        .all()
    )


@router.patch("/deliveries/{order_id}/respond")
def respond_to_offer(
    order_id: str,
    payload: OfferResponse,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    """
    Handles two kinds of offers with the same accept/decline shape: the
    origin pickup offer (`assigned`) and the destination-hub last-mile offer
    (`dest_hub`, created by hub staff assigning a rider for the final leg).
    """
    rider_profile = _rider_profile(db, current_user)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.rider_id != rider_profile.id:
        raise HTTPException(status_code=404, detail="Delivery offer not found")
    if order.status not in (OrderStatus.assigned, OrderStatus.dest_hub) or order.rider_accepted is True:
        raise HTTPException(status_code=400, detail="This offer is no longer awaiting a response")

    is_last_mile_offer = order.status == OrderStatus.dest_hub

    if payload.accept:
        order.rider_accepted = True
        if is_last_mile_offer:
            transition(db, order, OrderStatus.out_for_delivery, actor=current_user, note="Rider accepted last-mile delivery")
        else:
            transition(db, order, order.status, actor=current_user, note="Rider accepted the delivery")
        message = "Delivery accepted"
    else:
        # Decline: unassign. A pickup offer goes back to the pool (`created`);
        # a last-mile offer stays at `dest_hub` for hub staff to reassign.
        order.rider_id = None
        order.rider_accepted = None
        if is_last_mile_offer:
            transition(db, order, order.status, actor=current_user, note="Rider declined last-mile delivery")
        else:
            transition(db, order, OrderStatus.created, actor=current_user, note="Rider declined the delivery")
        message = "Delivery declined"

    db.commit()
    return {"message": message}


@router.patch("/deliveries/{order_id}/status")
def update_delivery_status(
    order_id: str,
    new_status: OrderStatus,
    note: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(db, current_user)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.rider_id != rider_profile.id:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if new_status == OrderStatus.delivered:
        raise HTTPException(
            status_code=400,
            detail="Marking a delivery as delivered requires OTP + photo + GPS - use the proof-of-delivery endpoint instead.",
        )
    if new_status not in RIDER_SETTABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Riders cannot set status to '{new_status.value}' directly - it's driven by hub/manifest scans.",
        )

    if new_status == OrderStatus.picked_up:
        if lat is None or lng is None:
            raise HTTPException(status_code=400, detail="GPS location is required to confirm pickup.")
        transition(db, order, new_status, actor=current_user, note=note, lat=lat, lng=lng, reference_address=order.pickup_address)
    elif new_status == OrderStatus.failed:
        transition(db, order, new_status, actor=current_user, note=note, lat=lat, lng=lng)
        attempt_number = db.query(DeliveryAttempt).filter(DeliveryAttempt.order_id == order.id).count() + 1
        db.add(DeliveryAttempt(order_id=order.id, attempt_number=attempt_number, status="failed", notes=note))
        if attempt_number >= 3:
            transition(db, order, OrderStatus.rto, actor=current_user, note=f"Auto-RTO after {attempt_number} failed delivery attempts")
    else:
        transition(db, order, new_status, actor=current_user, note=note, lat=lat, lng=lng)

    db.commit()
    db.refresh(order)
    return {"message": "Status updated", "status": order.status}


@router.post("/deliveries/{order_id}/send-delivery-otp", response_model=DeliveryOtpOut)
def send_delivery_otp(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(db, current_user)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.rider_id != rider_profile.id:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if not order.dropoff_address or not order.dropoff_address.contact_phone:
        raise HTTPException(status_code=400, detail="No recipient phone number on file for this delivery.")

    otp_service.send_otp(db, order.dropoff_address.contact_phone)
    return DeliveryOtpOut(message="OTP sent to recipient", expires_in_minutes=otp_service.OTP_EXPIRY_MINUTES)


@router.post("/deliveries/{order_id}/proof-of-delivery", response_model=OrderOut)
def submit_proof_of_delivery(
    order_id: str,
    photo: UploadFile = File(...),
    otp_code: str = Form(...),
    lat: float = Form(...),
    lng: float = Form(...),
    recipient_name: str | None = Form(None),
    note: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    """Riders call this to close out a delivery: requires OTP (verified against
    the recipient's phone), a photo, and GPS - all three, no exceptions - and
    moves the order to `delivered` in one step so a delivery can never be
    marked complete with any piece of evidence missing."""
    rider_profile = _rider_profile(db, current_user)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.rider_id != rider_profile.id:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if order.status != OrderStatus.out_for_delivery:
        raise HTTPException(
            status_code=400,
            detail="Delivery must be out for delivery before it can be marked delivered.",
        )

    if not order.dropoff_address or not order.dropoff_address.contact_phone:
        raise HTTPException(status_code=400, detail="No recipient phone number on file - cannot verify OTP.")
    otp_service.verify_otp(db, order.dropoff_address.contact_phone, otp_code)

    if recipient_name is not None:
        recipient_name = recipient_name.strip()[:150] or None

    photo_url = save_pod_photo(order.id, photo)

    order.proof_of_delivery_url = photo_url
    order.proof_of_delivery_recipient_name = recipient_name

    history_note = note or (f"Received by {recipient_name}" if recipient_name else None)
    transition(db, order, OrderStatus.delivered, actor=current_user, note=history_note, lat=lat, lng=lng)

    # COD orders get a T+1 settlement record (and rider wallet credit) the moment they're delivered.
    create_cod_settlement(db, order, delivered_by=current_user)

    db.commit()
    db.refresh(order)

    return order