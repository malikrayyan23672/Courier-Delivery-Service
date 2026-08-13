from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.address import Address
from app.models.order import Order, CreatedByType, BookingChannel, OrderStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.rider import RiderProfile, RiderStatus
from app.models.tracking_event import TrackingEvent
from app.models.staff import StaffProfile
from app.models.branch import Branch
from app.models.zone import Zone
from app.models.discount import Discount
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
    # package_size: str | None,
    package_description: str | None,
    payment_method: PaymentMethod = PaymentMethod.online_gateway,
    collected_by_staff_id: str | None = None,
    discount_code: str | None = None,
) -> Order:
    pickup_address = Address(**pickup.model_dump())
    dropoff_address = Address(**dropoff.model_dump())
    db.add_all([pickup_address, dropoff_address])
    db.flush()  # get IDs without committing yet

    price = estimate_price(pickup_address, dropoff_address, package_weight_kg)

    # Determine zone and branch
    zone_id = None
    branch_id = None

    if created_by_type == CreatedByType.staff:
        staff_profile = db.query(StaffProfile).filter(StaffProfile.user_id == created_by_id).first()
        if staff_profile and staff_profile.branch_id:
            branch_id = staff_profile.branch_id
            if staff_profile.branch:
                zone_id = staff_profile.branch.zone_id
    elif created_by_type == CreatedByType.customer:
        if pickup.city:
            zone = db.query(Zone).filter(func.lower(Zone.name) == func.lower(pickup.city.strip())).first()
            if zone:
                zone_id = zone.id
                branch = db.query(Branch).filter(Branch.zone_id == zone.id, Branch.status == "active").first()
                if branch:
                    branch_id = branch.id

    discount_id, discount_amount = _apply_discount(
        db,
        customer_id=customer_id,
        price=price,
        code=discount_code,
    )

    order = Order(
        customer_id=customer_id,
        created_by_id=created_by_id,
        created_by_type=created_by_type,
        booking_channel=booking_channel,
        pickup_address_id=pickup_address.id,
        dropoff_address_id=dropoff_address.id,
        package_weight_kg=package_weight_kg,
        # package_size=package_size,
        package_description=package_description,
        estimated_price=price,
        discount_id=discount_id,
        discount_amount=discount_amount,
        final_price=round(price - (discount_amount or 0.0), 2),
        zone_id=zone_id,
        branch_id=branch_id,
    )
    db.add(order)
    db.flush()

    payment = Payment(
        order_id=order.id,
        amount=order.final_price or price,
        method=payment_method,
        status=PaymentStatus.paid if payment_method == PaymentMethod.cash else PaymentStatus.pending,
        collected_by_staff_id=collected_by_staff_id,
    )
    db.add(payment)

    db.commit()
    db.refresh(order)

    _auto_assign_rider(db, order)
    db.commit()
    db.refresh(order)
    return order


def _apply_discount(
    db: Session,
    customer_id: str,
    price: float,
    code: str | None,
) -> tuple[str | None, float | None]:
    """
    Layer 6 - login-only discounts. Always resolves against the authenticated
    customer (this helper is only reachable from the authenticated order flow),
    so an anonymous visitor can never claim the discount.
    """
    discount = None

    if code:
        discount = db.query(Discount).filter(func.lower(Discount.code) == code.strip().lower()).first()
        if not discount:
            raise HTTPException(
                status_code=400,
                detail="Invalid discount code",
            )
    else:
        # No code: auto-apply a seeded 'first shipment' discount, but only for
        # a customer who has never placed an order yet (signup bonus).
        has_orders = db.query(Order).filter(Order.customer_id == customer_id).first() is not None
        if not has_orders:
            discount = (
                db.query(Discount)
                .filter(Discount.is_auto_applied.is_(True), Discount.is_active.is_(True))
                .first()
            )

    if not discount:
        return None, None

    if discount.requires_login:
        # Already guaranteed - customer is authenticated in this flow.
        pass

    if not discount.is_redeemable():
        raise HTTPException(status_code=400, detail="This discount is no longer available")

    if discount.min_order_value and price < discount.min_order_value:
        raise HTTPException(
            status_code=400,
            detail=f"Order value must be at least {discount.min_order_value} to use this discount",
        )

    discount.uses_count = (discount.uses_count or 0) + 1
    db.flush()

    return str(discount.id), round(discount.apply(price), 2)


def _auto_assign_rider(db: Session, order: Order) -> RiderProfile | None:
    if not order.zone_id:
        return None

    rider = (
        db.query(RiderProfile)
        .join(Branch, RiderProfile.branch_id == Branch.id)
        .filter(
            RiderProfile.status == RiderStatus.active,
            RiderProfile.is_available.is_(True),
            Branch.zone_id == order.zone_id
        )
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
