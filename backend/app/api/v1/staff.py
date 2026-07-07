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
        # package_size=payload.package_size,
        package_description=payload.package_description,
        payment_method=PaymentMethod(payload.payment_method),
        collected_by_staff_id=current_user.id if payload.payment_method == "cash" else None,
    )
    return order


from app.models.staff import StaffProfile
from app.models.rider import RiderProfile, RiderStatus
from app.models.order import Order, OrderStatus
from app.models.tracking_event import TrackingEvent
from app.models.branch import Branch


@router.get("/orders", response_model=list[OrderOut])
def list_branch_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
):
    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.branch_id:
        raise HTTPException(status_code=400, detail="You must belong to a branch to list branch orders")
    
    return db.query(Order).filter(Order.branch_id == staff_profile.branch_id).order_by(Order.created_at.desc()).all()


@router.get("/riders")
def list_branch_zone_riders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
):
    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.branch_id or not staff_profile.branch:
        raise HTTPException(status_code=400, detail="You must belong to a branch to list active riders")
    
    zone_id = staff_profile.branch.zone_id
    if not zone_id:
        raise HTTPException(status_code=400, detail="Your branch must belong to a zone to list active riders")

    riders = (
        db.query(RiderProfile)
        .join(Branch, RiderProfile.branch_id == Branch.id)
        .filter(RiderProfile.status == RiderStatus.active, Branch.zone_id == zone_id)
        .all()
    )

    return [
        {
            "rider_id": r.id,
            "full_name": r.user.full_name,
            "phone": r.user.phone,
            "vehicle_type": r.vehicle_type,
            "is_available": r.is_available,
            "rating": r.rating,
        }
        for r in riders
    ]


@router.patch("/orders/{order_id}/assign-rider/{rider_id}")
def staff_assign_rider(
    order_id: str,
    rider_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
):
    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.branch_id or not staff_profile.branch:
        raise HTTPException(status_code=400, detail="You must belong to a branch to assign riders")
    
    zone_id = staff_profile.branch.zone_id
    if not zone_id:
        raise HTTPException(status_code=400, detail="Your branch must belong to a zone to assign riders")

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify order is in the staff member's branch's zone
    if order.zone_id != zone_id:
        raise HTTPException(status_code=403, detail="You can only assign riders to orders inside your branch's zone")

    rider = (
        db.query(RiderProfile)
        .join(Branch, RiderProfile.branch_id == Branch.id)
        .filter(
            RiderProfile.id == rider_id,
            RiderProfile.status == RiderStatus.active,
            Branch.zone_id == zone_id
        )
        .first()
    )
    if not rider:
        raise HTTPException(status_code=404, detail="Active rider not found in your branch's zone")

    order.rider_id = rider.id
    order.status = OrderStatus.assigned
    order.rider_accepted = None
    db.add(TrackingEvent(order_id=order.id, status=OrderStatus.assigned.value, note=f"Manually assigned by staff {current_user.full_name} at branch {staff_profile.branch.name}"))
    db.commit()

    return {"message": "Rider assigned successfully"}
