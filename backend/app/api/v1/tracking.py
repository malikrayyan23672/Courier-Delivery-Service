from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.order import Order
from app.models.rider import RiderProfile

router = APIRouter(prefix="/tracking", tags=["Tracking"])


@router.get("/{tracking_number}")
def track_order(tracking_number: str, db: Session = Depends(get_db)):
    """
    Public endpoint - no auth required, since customers share tracking
    numbers with recipients who may not have an account.
    Rate-limit this in production to prevent tracking-number enumeration.
    Includes the live rider position (and their phone number) while the
    parcel is out for delivery.
    """
    order = (
        db.query(Order)
        .options(
            joinedload(Order.rider).joinedload(RiderProfile.user),
            joinedload(Order.pickup_address),
            joinedload(Order.dropoff_address),
        )
        .filter(Order.tracking_number == tracking_number)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Tracking number not found")

    status = order.status.value if hasattr(order.status, "value") else order.status

    rider = None
    if order.rider and status in ("out_for_delivery", "delivered", "picked_up", "in_transit"):
        rider = {
            "full_name": order.rider.user.full_name if order.rider.user else None,
            "phone": order.rider.user.phone if order.rider.user else None,
            "vehicle_type": order.rider.vehicle_type,
            "latitude": order.rider.current_lat,
            "longitude": order.rider.current_lng,
        }

    return {
        "tracking_number": order.tracking_number,
        "status": status,
        "pickup_city": order.pickup_address.city if order.pickup_address else None,
        "dropoff_city": order.dropoff_address.city if order.dropoff_address else None,
        "history": [
            {"status": e.status.value if hasattr(e.status, "value") else e.status,
             "note": e.note, "timestamp": e.created_at}
            for e in order.tracking_events
        ],
        "rider": rider,
    }