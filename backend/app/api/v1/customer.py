from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.order import CreatedByType, BookingChannel
from app.schemas.order import OrderCreateRequest, OrderOut
from app.services.order_service import create_order

router = APIRouter(prefix="/customer", tags=["Customer"])


@router.post("/orders", response_model=OrderOut)
def book_order(
    payload: OrderCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("customer")),
):
    order = create_order(
        db=db,
        customer_id=current_user.id,
        created_by_id=current_user.id,
        created_by_type=CreatedByType.customer,
        booking_channel=BookingChannel.online,
        pickup=payload.pickup_address,
        dropoff=payload.dropoff_address,
        package_weight_kg=payload.package_weight_kg,
        package_description=payload.package_description,
    )
    return order


@router.get("/orders", response_model=list[OrderOut])
def list_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("customer")),
):
    return current_user.orders_placed
