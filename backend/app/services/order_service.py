from sqlalchemy.orm import Session

from app.models.address import Address
from app.models.order import Order, CreatedByType, BookingChannel, OrderStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.rider import RiderProfile, RiderStatus
from app.models.tracking_event import TrackingEvent
from app.services.pricing_service import estimate_price
from app.schemas.order import AddressInput


def create_order(
    db: Session,
    customer_id: str,
    created_by_id: str,
    created_by_type: CreatedByType,
    booking_channel: BookingChannel,
    pickup: AddressInput,
    dropoff: AddressInput,
    package_weight_kg: float | None,
    package_size: str | None,
    package_description: str | None,
    payment_method: PaymentMethod = PaymentMethod.online_gateway,
    collected_by_staff_id: str | None = None,
) -> Order:
    pickup_address = Address(**pickup.model_dump())
    dropoff_address = Address(**dropoff.model_dump())
    db.add_all([pickup_address, dropoff_address])
    db.flush()  # get IDs without committing yet

    price = estimate_price(pickup_address, dropoff_address, package_weight_kg)

    order = Order(
        customer_id=customer_id,
        created_by_id=created_by_id,
        created_by_type=created_by_type,
        booking_channel=booking_channel,
        pickup_address_id=pickup_address.id,
        dropoff_address_id=dropoff_address.id,
        package_weight_kg=package_weight_kg,
        package_size=package_size,
        package_description=package_description,
        estimated_price=price,
    )
    db.add(order)
    db.flush()

    payment = Payment(
        order_id=order.id,
        amount=price,
        method=payment_method,
        status=PaymentStatus.paid if payment_method == PaymentMethod.cash else PaymentStatus.pending,
        collected_by_staff_id=collected_by_staff_id,
    )
    db.add(payment)

    db.commit()
    db.refresh(order)

    _auto_assign_rider(db, order)
    return order


def _auto_assign_rider(db: Session, order: Order) -> RiderProfile | None:
    rider = (
        db.query(RiderProfile)
        .filter(RiderProfile.status == RiderStatus.active, RiderProfile.is_available.is_(True))
        .order_by(RiderProfile.rating.desc(), RiderProfile.created_at.asc())
        .first()
    )
    if not rider:
        return None

    order.rider_id = rider.id
    order.status = OrderStatus.assigned
    order.rider_accepted = None
    db.add(
        TrackingEvent(
            order_id=order.id,
            status=OrderStatus.assigned.value,
            note=f"Auto-assigned to rider {rider.user.full_name}",
        )
    )
    return rider
