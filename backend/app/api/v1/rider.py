from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.order import Order, OrderStatus
from app.models.tracking_event import TrackingEvent
from app.schemas.order import OrderOut
from app.schemas.rider import RiderMeOut, RiderStatsOut, AvailabilityUpdate, AvailabilityOut, OfferResponse

router = APIRouter(prefix="/rider", tags=["Rider"])

ACTIVE_STATUSES = (OrderStatus.assigned, OrderStatus.picked_up, OrderStatus.in_transit)


def _rider_profile(current_user: User):
    rider_profile = current_user.rider_profile
    if not rider_profile:
        raise HTTPException(status_code=400, detail="No rider profile found for this account")
    return rider_profile


@router.get("/me", response_model=RiderMeOut)
def my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(current_user)
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
    )


@router.patch("/availability", response_model=AvailabilityOut)
def update_availability(
    payload: AvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(current_user)
    rider_profile.is_available = payload.is_available
    db.commit()
    return AvailabilityOut(is_available=rider_profile.is_available)


@router.get("/deliveries", response_model=list[OrderOut])
def my_deliveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = _rider_profile(current_user)

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
    rider_profile = _rider_profile(current_user)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.rider_id != rider_profile.id:
        raise HTTPException(status_code=404, detail="Delivery offer not found")
    if order.status != OrderStatus.assigned or order.rider_accepted is True:
        raise HTTPException(status_code=400, detail="This offer is no longer awaiting a response")

    if payload.accept:
        order.rider_accepted = True
        db.add(TrackingEvent(order_id=order.id, status=order.status.value, note="Rider accepted the delivery"))
        message = "Delivery accepted"
    else:
        # Decline: unassign so the order goes back into the admin's assignment pool
        order.rider_id = None
        order.rider_accepted = None
        order.status = OrderStatus.created
        db.add(TrackingEvent(order_id=order.id, status=OrderStatus.created.value, note="Rider declined the delivery"))
        message = "Delivery declined"

    db.commit()
    return {"message": message}


@router.patch("/deliveries/{order_id}/status")
def update_delivery_status(
    order_id: str,
    new_status: OrderStatus,
    note: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.rider_id != current_user.rider_profile.id:
        raise HTTPException(status_code=404, detail="Delivery not found")

    order.status = new_status
    db.add(TrackingEvent(order_id=order.id, status=new_status.value, note=note))
    db.commit()

    return {"message": "Status updated", "status": new_status}