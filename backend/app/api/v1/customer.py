from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.order import CreatedByType, BookingChannel, Order
from app.schemas.order import (
    OrderCreateRequest,
    OrderOut,
    OrderDetailOut,
    RiderContactOut,
    AddressOut,
    TrackingEventOut,
    PaymentOut,
)
from app.schemas.user import UserOut
from app.services.order_service import create_order

router = APIRouter(prefix="/customer", tags=["Customer"])


@router.get("/me", response_model=UserOut)
def get_my_profile(
    current_user: User = Depends(require_roles("customer")),
):
    return UserOut.from_orm_with_role(current_user)


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
        # package_size=payload.package_size,
        package_description=payload.package_description,
    )
    return order


@router.get("/orders", response_model=list[OrderOut])
def list_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("customer")),
):
    return sorted(current_user.orders_placed, key=lambda o: o.created_at, reverse=True)


@router.get("/orders/{order_id}", response_model=OrderDetailOut)
def get_my_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("customer")),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.customer_id != current_user.id:
        # 404 rather than 403 - don't confirm to a customer that some other order_id exists
        raise HTTPException(status_code=404, detail="Order not found")

    # Built field-by-field rather than OrderDetailOut.model_validate(order): RiderProfile
    # doesn't carry full_name/phone directly (those live on the linked User), so the ORM's
    # attribute-based auto-mapping can't resolve the nested `rider` field on its own.
    rider_contact = None
    if order.rider and order.rider.user:
        rider_contact = RiderContactOut(
            full_name=order.rider.user.full_name,
            phone=order.rider.user.phone,
            vehicle_type=order.rider.vehicle_type,
            rating=order.rider.rating,
        )

    return OrderDetailOut(
        id=str(order.id),
        tracking_number=order.tracking_number,
        status=order.status,
        booking_channel=order.booking_channel,
        pickup_address=AddressOut.model_validate(order.pickup_address) if order.pickup_address else None,
        dropoff_address=AddressOut.model_validate(order.dropoff_address) if order.dropoff_address else None,
        package_weight_kg=order.package_weight_kg,
        # package_size=order.package_size,
        package_description=order.package_description,
        estimated_price=order.estimated_price,
        final_price=order.final_price,
        rider_accepted=order.rider_accepted,
        created_at=order.created_at,
        tracking_events=[TrackingEventOut.model_validate(e) for e in order.tracking_events],
        payment=PaymentOut.model_validate(order.payment) if order.payment else None,
        rider=rider_contact,
    )
