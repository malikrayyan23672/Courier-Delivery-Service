from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role
from app.models.order import CreatedByType, BookingChannel
from app.models.payment import PaymentMethod
from app.schemas.order import StaffOrderCreateRequest, OrderOut
from app.services.order_service import create_order
import secrets

router = APIRouter(prefix="/staff", tags=["Staff Panel"])


@router.post("/orders", response_model=OrderOut)
def book_walk_in_order(
    payload: StaffOrderCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
):
    """
    Staff books a courier on behalf of a walk-in customer.
    - If customer_id is provided, link to that existing account.
    - Otherwise, create a lightweight guest customer record from the
      contact details given at the counter.
    """
    if payload.customer_id:
        customer = db.query(User).filter(User.id == payload.customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
    else:
        if not payload.guest_full_name or not payload.guest_phone:
            raise HTTPException(
                status_code=400,
                detail="Provide either customer_id or guest_full_name + guest_phone",
            )

        existing = db.query(User).filter(User.phone == payload.guest_phone).first()
        if existing:
            customer = existing
        else:
            customer_role = db.query(Role).filter(Role.name == "customer").first()
            # Guest accounts get a random unusable password - they can "forgot password" later if they want online access
            customer = User(
                full_name=payload.guest_full_name,
                phone=payload.guest_phone,
                email=payload.guest_email or f"guest_{payload.guest_phone}@placeholder.local",
                hashed_password=hash_password(secrets.token_urlsafe(16)),
                role_id=customer_role.id,
                is_verified=False,
            )
            db.add(customer)
            db.flush()

    order = create_order(
        db=db,
        customer_id=customer.id,
        created_by_id=current_user.id,          # audit: which staff member booked this
        created_by_type=CreatedByType.staff,
        booking_channel=BookingChannel.walk_in,
        pickup=payload.pickup_address,
        dropoff=payload.dropoff_address,
        package_weight_kg=payload.package_weight_kg,
        package_description=payload.package_description,
        payment_method=PaymentMethod(payload.payment_method),
        collected_by_staff_id=current_user.id if payload.payment_method == "cash" else None,
    )
    return order
