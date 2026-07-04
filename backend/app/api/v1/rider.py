from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.order import Order, OrderStatus
from app.models.tracking_event import TrackingEvent
from app.schemas.order import OrderOut

router = APIRouter(prefix="/rider", tags=["Rider"])


@router.get("/deliveries", response_model=list[OrderOut])
def my_deliveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("rider")),
):
    rider_profile = current_user.rider_profile
    if not rider_profile:
        raise HTTPException(status_code=400, detail="No rider profile found for this account")

    return db.query(Order).filter(Order.rider_id == rider_profile.id).all()


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
