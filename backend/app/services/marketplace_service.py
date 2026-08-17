from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.order import Order, OrderStatus, CreatedByType, BookingChannel
from app.models.payment import PaymentMethod
from app.models.product import Product
from app.models.rating import Rating
from app.models.user import User
from app.schemas.order import AddressInput
from app.services.order_service import create_order, get_or_create_guest_customer


def create_marketplace_order(
    db: Session,
    product: Product,
    quantity: int,
    dropoff: AddressInput,
    payment_method: PaymentMethod,
    current_user: User | None,
    guest_full_name: str | None,
    guest_phone: str | None,
    guest_email: str | None,
    discount_code: str | None,
) -> Order:
    if not product.is_active:
        raise HTTPException(status_code=400, detail="This product is no longer available")
    if product.stock_quantity < quantity:
        raise HTTPException(status_code=400, detail=f"Only {product.stock_quantity} left in stock")

    if current_user:
        customer_id = current_user.id
        allow_discount = True  # signed-in buyer - the signup discount TRD asks for
    else:
        if not guest_full_name or not guest_phone:
            raise HTTPException(
                status_code=400,
                detail="Sign in, or provide guest_full_name and guest_phone to check out as a guest",
            )
        guest = get_or_create_guest_customer(db, full_name=guest_full_name, phone=guest_phone, email=guest_email)
        customer_id = guest.id
        allow_discount = False  # guest checkout never qualifies for the login-only discount

    business = product.business
    pickup = AddressInput(
        full_address=business.pickup_address,
        city=business.city,
        contact_name=business.company_name,
        contact_phone=business.phone,
    )

    order = create_order(
        db=db,
        customer_id=str(customer_id),
        created_by_id=str(customer_id),
        created_by_type=CreatedByType.customer,
        booking_channel=BookingChannel.online,
        pickup=pickup,
        dropoff=dropoff,
        package_weight_kg=round(product.unit_weight_kg * quantity, 2),
        package_description=f"{quantity} x {product.name}",
        payment_method=payment_method,
        discount_code=discount_code,
        allow_discount=allow_discount,
        product_id=str(product.id),
        quantity=quantity,
        unit_price=product.price,
        seller_business_id=str(product.business_id),
    )

    # Simple check-then-decrement (matches this codebase's existing level of
    # rigor elsewhere) - not safe under high concurrency on the same SKU, but
    # correct for the common case without a row-lock migration.
    product.stock_quantity -= quantity
    db.commit()
    db.refresh(order)
    return order


def submit_rating(
    db: Session,
    order: Order,
    score: int,
    comment: str | None,
    current_user: User | None,
    rater_phone: str | None,
) -> Rating:
    if order.status != OrderStatus.delivered:
        raise HTTPException(status_code=400, detail="You can only rate a delivered order")

    is_seller = bool(current_user and current_user.business_id and order.product and str(order.product.business_id) == str(current_user.business_id))

    if is_seller:
        rater_role, target_type = "seller", "customer"
    else:
        rater_role, target_type = "customer", "seller"
        if current_user:
            if str(order.customer_id) != str(current_user.id):
                raise HTTPException(status_code=403, detail="This isn't your order")
        else:
            if not rater_phone or not order.customer or order.customer.phone != rater_phone.strip():
                raise HTTPException(status_code=403, detail="Provide the phone number this order was placed under")
        if not order.product:
            raise HTTPException(status_code=400, detail="This order has no seller to rate")

    already = (
        db.query(Rating)
        .filter(Rating.order_id == order.id, Rating.rater_role == rater_role, Rating.target_type == target_type)
        .first()
    )
    if already:
        raise HTTPException(status_code=400, detail="You've already rated this order")

    rating = Rating(
        order_id=order.id,
        rater_role=rater_role,
        target_type=target_type,
        score=score,
        comment=comment,
        target_business_id=order.product.business_id if target_type == "seller" and order.product else None,
        target_user_id=order.customer_id if target_type == "customer" else None,
        target_phone=order.customer.phone if target_type == "customer" and order.customer else None,
    )
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return rating
