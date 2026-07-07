from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role
from app.models.order import Order, OrderStatus
from app.models.rider import RiderProfile, RiderStatus
from app.models.tracking_event import TrackingEvent
from app.schemas.order import OrderOut
from app.schemas.auth import AdminCreateUserRequest
from app.schemas.user import UserOut

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/orders", response_model=list[OrderOut])
def list_all_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    return db.query(Order).order_by(Order.created_at.desc()).limit(200).all()


@router.patch("/orders/{order_id}/assign-rider/{rider_id}")
def assign_rider(
    order_id: str,
    rider_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    rider = db.query(RiderProfile).filter(
        RiderProfile.id == rider_id, RiderProfile.status == RiderStatus.active
    ).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Active rider not found")

    order.rider_id = rider.id
    order.status = "assigned"
    order.rider_accepted = None
    db.add(TrackingEvent(order_id=order.id, status="assigned", note=f"Assigned to rider {rider_id}"))
    db.commit()

    return {"message": "Rider assigned successfully"}


@router.get("/riders")
def list_riders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Active riders available for assignment - used to populate the assign-rider dropdown."""
    riders = db.query(RiderProfile).filter(RiderProfile.status == RiderStatus.active).all()
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


@router.get("/users", response_model=list[UserOut])
def list_staff_and_riders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Lists non-customer accounts (staff/rider/admin) for management purposes."""
    users = (
        db.query(User)
        .join(Role)
        .filter(Role.name.in_(["staff", "rider", "admin", "super_admin", "customer"]))
        .order_by(User.created_at.desc())
        .all()
    )
    return [UserOut.from_orm_with_role(u) for u in users]


@router.post("/users", response_model=UserOut, status_code=201)
def create_staff_or_rider(
    payload: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """
    Admin onboards a staff/rider/admin account directly - no OTP step, since
    the admin is vouching for this person (typically in person or via HR).
    """
    existing = db.query(User).filter(
        (User.email == payload.email) | (User.phone == payload.phone)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone already registered")

    role = db.query(Role).filter(Role.name == payload.role).first()
    if not role:
        raise HTTPException(status_code=500, detail=f"Role '{payload.role}' not seeded")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        cnic=payload.cnic,
        hashed_password=hash_password(payload.password),
        role_id=role.id,
        is_active=True,
        is_verified=True,  # admin-onboarded accounts skip OTP verification
    )
    db.add(user)
    db.flush()

    if payload.role == "rider":
        db.add(RiderProfile(user_id=user.id, status=RiderStatus.active, is_available=False))

    db.commit()
    db.refresh(user)

    return UserOut.from_orm_with_role(user)


@router.get("/analytics")
def analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Dashboard summary: order volume, revenue, channel mix, and top riders."""
    status_rows = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    status_counts = {(s.value if hasattr(s, "value") else s): c for s, c in status_rows}
    total_orders = sum(status_counts.values())

    total_revenue = (
        db.query(func.sum(Order.final_price)).filter(Order.status == OrderStatus.delivered).scalar() or 0.0
    )

    since = datetime.now(timezone.utc) - timedelta(days=7)
    daily_rows = (
        db.query(
            func.date(Order.created_at).label("day"),
            func.count(Order.id),
            func.sum(Order.final_price),
        )
        .filter(Order.created_at >= since, Order.status == OrderStatus.delivered)
        .group_by("day")
        .order_by("day")
        .all()
    )
    daily = [
        {"date": str(day), "orders": count, "revenue": round(revenue or 0.0, 2)}
        for day, count, revenue in daily_rows
    ]

    channel_rows = db.query(Order.booking_channel, func.count(Order.id)).group_by(Order.booking_channel).all()
    channel_counts = {(ch.value if hasattr(ch, "value") else ch): c for ch, c in channel_rows}

    top_rider_rows = (
        db.query(
            RiderProfile,
            func.count(Order.id).label("deliveries"),
            func.sum(Order.final_price).label("earnings"),
        )
        .join(Order, Order.rider_id == RiderProfile.id)
        .filter(Order.status == OrderStatus.delivered)
        .group_by(RiderProfile.id)
        .order_by(func.count(Order.id).desc())
        .limit(5)
        .all()
    )
    top_riders = [
        {
            "full_name": rider.user.full_name,
            "deliveries": deliveries,
            "earnings": round(earnings or 0.0, 2),
        }
        for rider, deliveries, earnings in top_rider_rows
    ]

    return {
        "total_orders": total_orders,
        "total_revenue": round(total_revenue, 2),
        "status_counts": status_counts,
        "channel_counts": channel_counts,
        "daily_last_7_days": daily,
        "top_riders": top_riders,
    }
