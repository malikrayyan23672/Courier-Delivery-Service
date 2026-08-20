from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.config import settings
from app.core.permissions import require_roles
from app.models.user import User
from app.models.rider import RiderProfile, RiderStatus
from app.models.order import Order, OrderStatus
from app.models.delivery_attempt import DeliveryAttempt
from app.models.hub import Hub
from app.models.staff import StaffProfile
from app.models.order_message import OrderMessage
from app.models.bus_network import ManifestItem, ScanStatus
from app.models.rider_status_request import RiderStatusRequest, RequestStatus
from app.models.parcel_unlock_request import ParcelUnlockRequest
from app.models.support_ticket import SupportTicket, SupportTicketMessage, SupportTicketStatus
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from app.schemas.order import OrderOut, OrderDetailOut, AddressOut, TrackingEventOut, PaymentOut
from app.schemas.notification import NotificationOut
from app.schemas.order_message import OrderMessageCreate, OrderMessageOut
from app.utils.uploads import save_pod_photo, save_failure_proof_photo
from app.services import otp_service
from app.services import notification_service
from app.services.order_service import haversine_meters, maybe_auto_assign_last_mile_rider, add_order_to_return_batch
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
    ReturnToHubRequest,
    DeliveryOtpOut,
    AvailabilityRequestCreate,
    RiderStatusRequestOut,
    ParcelUnlockRequestCreate,
    ParcelUnlockRequestOut,
    RiderManifestItemOut,
    SupportTicketCreate,
    SupportTicketMessageCreate,
    SupportTicketOut,
    SupportTicketMessageOut,
    EarningsDayOut,
    EarningsBreakdownOut,
    PerformanceDayOut,
    PerformanceOut,
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
# `delivered` requires the dedicated OTP+photo+GPS proof-of-delivery endpoint;
# `failed` requires the dedicated delivery-failed endpoint (cancellation photo
# on the 3rd attempt).
RIDER_SETTABLE_STATUSES = (OrderStatus.picked_up, OrderStatus.out_for_delivery)


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


WALLET_LOG_ACTIONS = ("rider_wallet_locked", "rider_wallet_unlocked", "rider_wallet_limit_updated")


@router.get("/wallet/history")
def my_wallet_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    """Every lock/unlock/limit-change event on this rider's COD cash-in-hand
    wallet (see settlement_service.py's lock_rider_wallet/unlock_rider_wallet/
    set_rider_wallet_limit, which already write these as audit log entries) -
    the wallet screen previously showed only the current balance with no
    history of how it got there."""
    rider_profile = _rider_profile(db, current_user)
    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.entity_type == "RiderProfile",
            AuditLog.entity_id == str(rider_profile.id),
            AuditLog.action.in_(WALLET_LOG_ACTIONS),
        )
        .order_by(AuditLog.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "details": log.details,
            "created_at": log.created_at,
        }
        for log in logs
    ]


@router.get("/notifications", response_model=list[NotificationOut])
def my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )


@router.patch("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


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


def _status_request_out(req: RiderStatusRequest) -> RiderStatusRequestOut:
    return RiderStatusRequestOut(
        id=req.id,
        rider_id=req.rider_id,
        rider_name=req.rider.user.full_name if req.rider and req.rider.user else None,
        requested_by_id=req.requested_by_id,
        requested_is_available=req.requested_is_available,
        note=req.note,
        status=req.status.value if hasattr(req.status, "value") else req.status,
        resolution_note=req.resolution_note,
        resolved_at=req.resolved_at,
        created_at=req.created_at,
    )


@router.post("/availability-requests", response_model=RiderStatusRequestOut)
def request_availability_change(
    payload: AvailabilityRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    """
    Submits a request to change is_available - does NOT flip the flag itself.
    A staff/admin approver must resolve it first
    (PATCH /staff/availability-requests/{id}/resolve).
    """
    rider_profile = _rider_profile(db, current_user)
    request = RiderStatusRequest(
        rider_id=rider_profile.id,
        requested_by_id=current_user.id,
        requested_is_available=payload.requested_is_available,
        note=payload.note,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return _status_request_out(request)


@router.get("/availability-requests", response_model=list[RiderStatusRequestOut])
def my_availability_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(db, current_user)
    requests = (
        db.query(RiderStatusRequest)
        .filter(RiderStatusRequest.rider_id == rider_profile.id)
        .order_by(RiderStatusRequest.created_at.desc())
        .all()
    )
    return [_status_request_out(r) for r in requests]


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
        .options(joinedload(Order.pickup_address), joinedload(Order.dropoff_address), joinedload(Order.hub))
        .filter(Order.rider_id == rider_profile.id)
        .order_by(Order.created_at.desc())
        .all()
    )


@router.get("/deliveries/{order_id}", response_model=OrderDetailOut)
def my_delivery_detail(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(db, current_user)
    order = (
        db.query(Order)
        .options(
            joinedload(Order.pickup_address),
            joinedload(Order.dropoff_address),
            joinedload(Order.tracking_events),
            joinedload(Order.payment),
            joinedload(Order.hub),
        )
        .filter(Order.id == order_id, Order.rider_id == rider_profile.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # Built field-by-field rather than OrderDetailOut.model_validate(order) - see the
    # same note in customer.get_my_order: RiderProfile doesn't carry full_name/phone
    # directly, so the ORM's attribute-based auto-mapping can't resolve `rider` alone.
    return OrderDetailOut(
        id=str(order.id),
        tracking_number=order.tracking_number,
        status=order.status,
        booking_channel=order.booking_channel,
        pickup_address=AddressOut.model_validate(order.pickup_address) if order.pickup_address else None,
        dropoff_address=AddressOut.model_validate(order.dropoff_address) if order.dropoff_address else None,
        package_weight_kg=order.package_weight_kg,
        package_description=order.package_description,
        estimated_price=order.estimated_price,
        final_price=order.final_price,
        discount_id=str(order.discount_id) if order.discount_id else None,
        discount_amount=order.discount_amount,
        rider_accepted=order.rider_accepted,
        branch_name=order.hub.name if order.hub else None,
        branch_address=order.hub.address if order.hub else None,
        branch_phone=order.hub.phone if order.hub else None,
        created_at=order.created_at,
        proof_of_delivery_url=order.proof_of_delivery_url,
        proof_of_delivery_recipient_name=order.proof_of_delivery_recipient_name,
        product_id=str(order.product_id) if order.product_id else None,
        quantity=order.quantity,
        unit_price=order.unit_price,
        tracking_events=[TrackingEventOut.model_validate(e) for e in order.tracking_events],
        payment=PaymentOut.model_validate(order.payment) if order.payment else None,
        rider=None,
        failed_attempt_count=db.query(DeliveryAttempt).filter(DeliveryAttempt.order_id == order.id).count(),
    )


@router.get("/parcels/nearby", response_model=list[OrderOut])
def nearby_parcels(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    """Unassigned parcels in the rider's zone available for self-claim, sorted
    by distance from the rider's last known location where possible."""
    rider_profile = _rider_profile(db, current_user)

    query = db.query(Order).options(
        joinedload(Order.pickup_address), joinedload(Order.dropoff_address)
    ).filter(Order.status == OrderStatus.created, Order.rider_id.is_(None))

    if rider_profile.hub_id:
        hub = db.query(Hub).filter(Hub.id == rider_profile.hub_id).first()
        if hub and hub.zone_id:
            query = query.filter(Order.zone_id == hub.zone_id)

    orders = query.order_by(Order.created_at.asc()).all()

    if rider_profile.current_lat is not None and rider_profile.current_lng is not None:
        def distance(order: Order) -> float:
            addr = order.pickup_address
            if not addr or addr.lat is None or addr.lng is None:
                return float("inf")
            return haversine_meters(rider_profile.current_lat, rider_profile.current_lng, addr.lat, addr.lng)

        orders = sorted(orders, key=distance)

    return orders


@router.post("/parcels/{order_id}/lock", response_model=OrderOut)
def lock_parcel(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(db, current_user)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Parcel not found")
    if order.status != OrderStatus.created or order.rider_id is not None:
        raise HTTPException(status_code=400, detail="This parcel is no longer available to claim")

    order.rider_id = rider_profile.id
    order.rider_accepted = True
    transition(db, order, OrderStatus.assigned, actor=current_user, note="Rider self-claimed parcel")
    db.commit()
    db.refresh(order)
    return order


def _unlock_request_out(req: ParcelUnlockRequest) -> ParcelUnlockRequestOut:
    return ParcelUnlockRequestOut(
        id=req.id,
        order_id=req.order_id,
        tracking_number=req.order.tracking_number if req.order else None,
        rider_id=req.rider_id,
        rider_name=req.rider.user.full_name if req.rider and req.rider.user else None,
        requested_by_id=req.requested_by_id,
        reason=req.reason,
        status=req.status.value if hasattr(req.status, "value") else req.status,
        resolution_note=req.resolution_note,
        resolved_at=req.resolved_at,
        created_at=req.created_at,
    )


@router.post("/deliveries/{order_id}/unlock-requests", response_model=ParcelUnlockRequestOut)
def request_parcel_unlock(
    order_id: str,
    payload: ParcelUnlockRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    """Requests to be released from an already-claimed delivery - needs
    staff/admin approval before the parcel actually unlocks and goes back
    to the pool. Only possible before pickup (order still `assigned`)."""
    rider_profile = _rider_profile(db, current_user)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.rider_id != rider_profile.id:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if order.status != OrderStatus.assigned:
        raise HTTPException(
            status_code=400,
            detail="A parcel can only be unlock-requested before pickup.",
        )

    request = ParcelUnlockRequest(
        order_id=order.id,
        rider_id=rider_profile.id,
        requested_by_id=current_user.id,
        reason=payload.reason,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return _unlock_request_out(request)


@router.get("/deliveries/{order_id}/unlock-requests", response_model=list[ParcelUnlockRequestOut])
def my_unlock_requests(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(db, current_user)
    requests = (
        db.query(ParcelUnlockRequest)
        .filter(ParcelUnlockRequest.order_id == order_id, ParcelUnlockRequest.rider_id == rider_profile.id)
        .order_by(ParcelUnlockRequest.created_at.desc())
        .all()
    )
    return [_unlock_request_out(r) for r in requests]


@router.get("/manifest-items/arrived", response_model=list[RiderManifestItemOut])
def arrived_manifest_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    """Crates arrived at the destination hub and assigned to this rider for
    last-mile delivery, ready to be scanned as physically picked up."""
    rider_profile = _rider_profile(db, current_user)
    items = (
        db.query(ManifestItem)
        .join(Order, ManifestItem.order_id == Order.id)
        .options(joinedload(ManifestItem.order))
        .filter(
            ManifestItem.scan_status == ScanStatus.arrived,
            Order.rider_id == rider_profile.id,
            Order.status.in_([OrderStatus.dest_hub, OrderStatus.out_for_delivery]),
        )
        .order_by(ManifestItem.scanned_at.asc().nullsfirst())
        .all()
    )
    return [
        RiderManifestItemOut(
            id=item.id,
            order_id=item.order_id,
            tracking_number=item.order.tracking_number if item.order else None,
            crate_label=item.crate_label,
            scan_status=item.scan_status.value if hasattr(item.scan_status, "value") else item.scan_status,
            scanned_at=item.scanned_at,
        )
        for item in items
    ]


@router.post("/manifest-items/{item_id}/scan-pickup", response_model=RiderManifestItemOut)
def scan_manifest_item_pickup(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(db, current_user)
    item = (
        db.query(ManifestItem)
        .options(joinedload(ManifestItem.order))
        .filter(ManifestItem.id == item_id)
        .first()
    )
    if not item or not item.order or item.order.rider_id != rider_profile.id:
        raise HTTPException(status_code=404, detail="Manifest item not found")
    if item.scan_status != ScanStatus.arrived:
        raise HTTPException(status_code=400, detail="This crate is not awaiting pickup")

    item.scan(ScanStatus.delivered)
    db.commit()
    db.refresh(item)
    return RiderManifestItemOut(
        id=item.id,
        order_id=item.order_id,
        tracking_number=item.order.tracking_number if item.order else None,
        crate_label=item.crate_label,
        scan_status=item.scan_status.value if hasattr(item.scan_status, "value") else item.scan_status,
        scanned_at=item.scanned_at,
    )


@router.post("/deliveries/{order_id}/return-to-hub", response_model=OrderOut)
def return_to_hub(
    order_id: str,
    payload: ReturnToHubRequest = ReturnToHubRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    """Rider physically drops an RTO parcel back at the hub. `rto` is a
    terminal state, so this just logs the handover as a tracking event
    rather than transitioning status - but it's the trigger for grouping
    the parcel into the hub's return batch (TRD: "Return batch auto-
    created"), since that's the point it's actually sitting at the hub
    ready to go out again."""
    rider_profile = _rider_profile(db, current_user)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.rider_id != rider_profile.id:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if order.status != OrderStatus.rto:
        raise HTTPException(status_code=400, detail="Only RTO parcels can be returned to hub")

    transition(db, order, order.status, actor=current_user, note="Returned to hub", lat=payload.lat, lng=payload.lng)
    add_order_to_return_batch(db, order)
    db.commit()
    db.refresh(order)
    return order


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
            # Automatic branches immediately re-offer to the next best rider;
            # manual branches leave it in the last-mile queue for hub staff.
            maybe_auto_assign_last_mile_rider(db, order, actor=current_user)
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
    if new_status == OrderStatus.failed:
        raise HTTPException(
            status_code=400,
            detail="Marking a delivery as failed requires the delivery-failed endpoint instead.",
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
    else:
        transition(db, order, new_status, actor=current_user, note=note, lat=lat, lng=lng)

    db.commit()
    db.refresh(order)
    return {"message": "Status updated", "status": order.status}


# Structured failure reasons a rider can pick - "refused" is the one the TRD
# calls out by name as its own immediate-RTO trigger, independent of attempt
# count ("3 attempts exhausted OR buyer refuses").
FAILURE_REASONS = {
    "unavailable", "refused", "unreachable", "reschedule_requested",
    "bad_address", "inaccessible", "safety", "other",
}


@router.post("/deliveries/{order_id}/delivery-failed", response_model=OrderOut)
def report_delivery_failed(
    order_id: str,
    note: str = Form(...),
    reason: str = Form("other"),
    lat: float | None = Form(None),
    lng: float | None = Form(None),
    photo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    """Records a failed doorstep delivery attempt. Auto-returns the parcel to
    origin (RTO) either on the 3rd attempt or immediately when the buyer
    refused the parcel outright - in both cases the rider won't get another
    chance to explain what happened, so a photo is required as proof, and
    the branch + seller are notified."""
    if reason not in FAILURE_REASONS:
        raise HTTPException(status_code=400, detail="Invalid failure reason")

    rider_profile = _rider_profile(db, current_user)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.rider_id != rider_profile.id:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if order.status != OrderStatus.out_for_delivery:
        raise HTTPException(status_code=400, detail="This delivery isn't currently out for delivery.")

    attempt_number = db.query(DeliveryAttempt).filter(DeliveryAttempt.order_id == order.id).count() + 1
    is_buyer_refusal = reason == "refused"
    is_final_attempt = attempt_number >= 3 or is_buyer_refusal

    photo_url = None
    if is_final_attempt:
        if not photo:
            raise HTTPException(
                status_code=400,
                detail="A photo is required to report a buyer refusal or the 3rd failed attempt - it returns the parcel to origin.",
            )
        photo_url = save_failure_proof_photo(order.id, photo)
    elif photo:
        photo_url = save_failure_proof_photo(order.id, photo)

    transition(db, order, OrderStatus.failed, actor=current_user, note=note, lat=lat, lng=lng)
    db.add(DeliveryAttempt(order_id=order.id, attempt_number=attempt_number, status="failed", reason=reason, notes=note, photo_url=photo_url))

    if is_final_attempt:
        rto_reason = "the buyer refused the parcel" if is_buyer_refusal else f"{attempt_number} failed delivery attempts"
        transition(
            db, order, OrderStatus.rto, actor=current_user,
            note=f"Auto-RTO - {rto_reason} - proof attached",
        )
        for staff in db.query(StaffProfile).filter(StaffProfile.hub_id == order.hub_id).all():
            notification_service.notify(
                db, user_id=staff.user_id, title="Parcel returned to origin",
                message=f"{order.tracking_number} was returned - {rto_reason}.",
                type="warning", order_id=order.id,
            )
        if order.seller_business_id:
            for owner in db.query(User).filter(User.business_id == order.seller_business_id).all():
                notification_service.notify(
                    db, user_id=owner.id, title="Parcel returned to origin",
                    message=f"{order.tracking_number} couldn't be delivered - {rto_reason} - and is being returned.",
                    type="warning", order_id=order.id,
                )

    db.commit()
    db.refresh(order)
    return order


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

    otp = otp_service.send_otp(db, order.dropoff_address.contact_phone)
    return DeliveryOtpOut(
        message="OTP sent to recipient",
        expires_in_minutes=otp_service.OTP_EXPIRY_MINUTES,
        dev_otp=otp.otp_code if not settings.TWILIO_ACCOUNT_SID else None,
    )


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


# --- Support tickets ---

def _support_ticket_out(ticket: SupportTicket) -> SupportTicketOut:
    return SupportTicketOut(
        id=ticket.id,
        raised_by_id=ticket.raised_by_id,
        raised_by_name=ticket.raised_by.full_name if ticket.raised_by else None,
        subject=ticket.subject,
        order_id=ticket.order_id,
        tracking_number=ticket.order.tracking_number if ticket.order else None,
        status=ticket.status.value if hasattr(ticket.status, "value") else ticket.status,
        resolved_at=ticket.resolved_at,
        created_at=ticket.created_at,
        messages=[
            SupportTicketMessageOut(
                id=m.id,
                sender_id=m.sender_id,
                sender_name=m.sender.full_name if m.sender else None,
                body=m.body,
                created_at=m.created_at,
            )
            for m in ticket.messages
        ],
    )


@router.post("/support-tickets", response_model=SupportTicketOut)
def create_support_ticket(
    payload: SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    if payload.order_id:
        order = db.query(Order).filter(Order.id == payload.order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

    ticket = SupportTicket(
        raised_by_id=current_user.id,
        subject=payload.subject.strip(),
        order_id=payload.order_id,
    )
    db.add(ticket)
    db.flush()
    db.add(SupportTicketMessage(ticket_id=ticket.id, sender_id=current_user.id, body=payload.message.strip()))
    db.commit()
    db.refresh(ticket)
    return _support_ticket_out(ticket)


@router.get("/support-tickets", response_model=list[SupportTicketOut])
def my_support_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    tickets = (
        db.query(SupportTicket)
        .filter(SupportTicket.raised_by_id == current_user.id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return [_support_ticket_out(t) for t in tickets]


@router.get("/support-tickets/{ticket_id}", response_model=SupportTicketOut)
def support_ticket_detail(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    ticket = (
        db.query(SupportTicket)
        .filter(SupportTicket.id == ticket_id, SupportTicket.raised_by_id == current_user.id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")
    return _support_ticket_out(ticket)


@router.post("/support-tickets/{ticket_id}/messages", response_model=SupportTicketOut)
def reply_to_support_ticket(
    ticket_id: str,
    payload: SupportTicketMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    ticket = (
        db.query(SupportTicket)
        .filter(SupportTicket.id == ticket_id, SupportTicket.raised_by_id == current_user.id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")

    db.add(SupportTicketMessage(ticket_id=ticket.id, sender_id=current_user.id, body=payload.body.strip()))
    if ticket.status in (SupportTicketStatus.resolved, SupportTicketStatus.closed):
        ticket.status = SupportTicketStatus.in_progress
    db.commit()
    db.refresh(ticket)
    return _support_ticket_out(ticket)


# --- Order messages (rider <-> seller chat) ---

def _order_message_out(m: OrderMessage) -> OrderMessageOut:
    return OrderMessageOut(
        id=str(m.id),
        order_id=str(m.order_id),
        sender_id=str(m.sender_id),
        sender_name=m.sender.full_name if m.sender else None,
        sender_role=m.sender.role.name if m.sender and m.sender.role else None,
        body=m.body,
        created_at=m.created_at,
    )


def _my_delivery_order(db: Session, current_user: User, order_id: str) -> Order:
    rider_profile = _rider_profile(db, current_user)
    order = db.query(Order).filter(Order.id == order_id, Order.rider_id == rider_profile.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return order


@router.get("/deliveries/{order_id}/messages", response_model=list[OrderMessageOut])
def list_order_messages(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    order = _my_delivery_order(db, current_user, order_id)
    messages = (
        db.query(OrderMessage)
        .filter(OrderMessage.order_id == order.id)
        .order_by(OrderMessage.created_at)
        .all()
    )
    return [_order_message_out(m) for m in messages]


@router.post("/deliveries/{order_id}/messages", response_model=OrderMessageOut)
def send_order_message(
    order_id: str,
    payload: OrderMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    order = _my_delivery_order(db, current_user, order_id)
    message = OrderMessage(order_id=order.id, sender_id=current_user.id, body=payload.body.strip())
    db.add(message)

    if order.seller_business_id:
        for owner in db.query(User).filter(User.business_id == order.seller_business_id).all():
            notification_service.notify(
                db, user_id=owner.id, title=f"New message about {order.tracking_number}",
                message=message.body[:200], order_id=order.id,
            )

    db.commit()
    db.refresh(message)
    return _order_message_out(message)


# --- Earnings ---

@router.get("/earnings", response_model=EarningsBreakdownOut)
def my_earnings(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(db, current_user)
    days = max(1, min(days, 90))
    window_start = datetime.now(timezone.utc) - timedelta(days=days - 1)
    window_start = window_start.replace(hour=0, minute=0, second=0, microsecond=0)

    delivered_orders = (
        db.query(Order)
        .filter(
            Order.rider_id == rider_profile.id,
            Order.status == OrderStatus.delivered,
            Order.created_at >= window_start,
        )
        .all()
    )

    by_date: dict[str, dict[str, float]] = {}
    for order in delivered_orders:
        key = order.created_at.date().isoformat()
        bucket = by_date.setdefault(key, {"earnings": 0.0, "deliveries": 0})
        bucket["earnings"] += order.final_price or 0.0
        bucket["deliveries"] += 1

    daily = [
        EarningsDayOut(date=key, earnings=round(val["earnings"], 2), deliveries=int(val["deliveries"]))
        for key, val in sorted(by_date.items())
    ]

    return EarningsBreakdownOut(
        total_earnings=round(sum(d.earnings for d in daily), 2),
        total_deliveries=sum(d.deliveries for d in daily),
        daily=daily,
    )


@router.get("/performance", response_model=PerformanceOut)
def my_performance(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    """Day-bucketed delivered-vs-returned trend, so a rider can actually see
    how their performance moves over time - previously the only performance
    signal anywhere was the single static `rating` number, which nothing in
    the codebase ever recalculates (no rider-rating flow exists yet), so a
    real trend has to come from delivery outcomes instead."""
    rider_profile = _rider_profile(db, current_user)
    days = max(1, min(days, 90))
    window_start = datetime.now(timezone.utc) - timedelta(days=days - 1)
    window_start = window_start.replace(hour=0, minute=0, second=0, microsecond=0)

    # `delivered` and `rto` are this rider's only terminal outcomes for a
    # doorstep attempt - `failed` alone can still be retried, so it isn't
    # counted here as a completed negative outcome yet.
    outcomes = (
        db.query(Order)
        .filter(
            Order.rider_id == rider_profile.id,
            Order.status.in_([OrderStatus.delivered, OrderStatus.rto]),
            Order.updated_at >= window_start,
        )
        .all()
    )

    by_date: dict[str, dict[str, int]] = {}
    for order in outcomes:
        key = order.updated_at.date().isoformat()
        bucket = by_date.setdefault(key, {"delivered": 0, "failed": 0})
        if order.status == OrderStatus.delivered:
            bucket["delivered"] += 1
        else:
            bucket["failed"] += 1

    daily = [
        PerformanceDayOut(date=key, delivered=val["delivered"], failed=val["failed"])
        for key, val in sorted(by_date.items())
    ]
    total_delivered = sum(d.delivered for d in daily)
    total_failed = sum(d.failed for d in daily)
    total = total_delivered + total_failed

    return PerformanceOut(
        rating=rider_profile.rating,
        total_delivered=total_delivered,
        total_failed=total_failed,
        success_rate=round((total_delivered / total) * 100, 1) if total else 0.0,
        daily=daily,
    )