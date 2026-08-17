from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.core.security import hash_password
from app.models.user import User
from app.models.zone import Zone
from app.models.role import Role
from app.models.order import Order, OrderStatus
from app.models.rider import RiderProfile, RiderStatus
from app.models.tracking_event import TrackingEvent
from app.models.staff import StaffProfile
from app.models.branch import Branch
from app.models.zone import Zone
from app.models.settlement import Settlement, SettlementStatus
from app.schemas.order import OrderOut
from app.schemas.auth import AdminCreateUserRequest
from app.schemas.user import UserOut
from app.schemas.zone import ZoneOut
from app.schemas.zone import ZoneCreateRequest
from app.services.order_service import transition
from app.services.settlement_service import pending_cod_amount, rider_wallet_limit, rider_wallet_warning_at

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
    if rider.cod_wallet_locked and order.payment and order.payment.method.value == "cash":
        raise HTTPException(status_code=400, detail="This rider's COD wallet is locked and cannot accept new COD parcels")

    order.rider_id = rider.id
    order.rider_accepted = None
    transition(db, order, OrderStatus.assigned, actor=current_user, note=f"Assigned to rider {rider_id}")
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
            "cod_cash_held": round(r.cod_cash_held or 0.0, 2),
            "cod_wallet_locked": r.cod_wallet_locked or False,
            "wallet_limit": rider_wallet_limit(r),
            "wallet_warning_at": rider_wallet_warning_at(r),
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

@router.delete("/users/delete/{user_id}", status_code=204)
def delete_staff_or_rider(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin","super_admin"))):

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=502, detail="user not found to delete")

    db.delete(user)
    db.commit()

@router.patch("/users/{user_id}/status")
def set_user_active_status(
    user_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Activate / deactivate a user account. Deactivated accounts can no longer log in."""
    is_active = payload.get("is_active")
    if is_active is None or not isinstance(is_active, bool):
        raise HTTPException(status_code=400, detail="is_active (boolean) is required")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    user.is_active = is_active
    db.commit()
    return {"id": str(user.id), "full_name": user.full_name, "is_active": user.is_active}

@router.patch("/users/{user_id}")
def edit_user(
    user_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Edit a user's basic details (full_name / phone)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    full_name = payload.get("full_name")
    phone = payload.get("phone")
    if full_name is not None:
        if not isinstance(full_name, str) or len(full_name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Full name must be at least 2 characters")
        user.full_name = full_name.strip()
    if phone is not None:
        existing = db.query(User).filter(User.phone == phone, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already in use")
        user.phone = phone
    db.commit()
    return {"id": str(user.id), "full_name": user.full_name, "phone": user.phone, "email": user.email, "role": user.role.name if user.role else None, "is_active": user.is_active, "is_verified": user.is_verified}

# @router.post("/zones", response_model=ZoneOut, status_code=201)
# def add_zone(
#     payload: ZoneCreateRequest,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(require_roles("admin", "super_admin")),
# ):
#     existing = db.query(Zone).filter(Zone.name == payload.name).first()

#     if existing:
#         raise HTTPException(status_code=400, detail='Zone already exists')

#     zone = Zone(
#         name=payload.name,
#         description=payload.description,
#         is_active=payload.is_active
#     )

#     db.add(zone)
#     db.flush()
#     db.commit()

#     # return ZoneOut.

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
        db.add(RiderProfile(user_id=user.id, status=RiderStatus.active, is_available=False, branch_id=payload.branch_id))
    elif payload.role == "staff":
        db.add(StaffProfile(user_id=user.id, branch_id=payload.branch_id, designation=payload.designation))
        branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()

        if not branch:
            raise HTTPException(status_code=400, detail='branch could not found')

        branch.manager_id = user.id
        # db.add(TrackingEvent())
        db.commit()

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

    rto_count = status_counts.get(OrderStatus.rto.value, 0)
    delivered_count = status_counts.get(OrderStatus.delivered.value, 0)
    resolved_count = delivered_count + rto_count
    rto_rate = round((rto_count / resolved_count) * 100, 1) if resolved_count else 0.0

    cod_collected_total = db.query(func.sum(Settlement.amount)).scalar() or 0.0
    cod_pending_total = pending_cod_amount(db)

    avg_delivery_seconds = (
        db.query(func.avg(func.extract("epoch", Order.updated_at - Order.created_at)))
        .filter(Order.status == OrderStatus.delivered)
        .scalar()
    )
    avg_delivery_hours = round(avg_delivery_seconds / 3600, 1) if avg_delivery_seconds else None

    return {
        "total_orders": total_orders,
        "total_revenue": round(total_revenue, 2),
        "status_counts": status_counts,
        "channel_counts": channel_counts,
        "daily_last_7_days": daily,
        "top_riders": top_riders,
        "rto_rate": rto_rate,
        "cod_collected_total": round(cod_collected_total, 2),
        "cod_pending_total": cod_pending_total,
        "avg_delivery_hours": avg_delivery_hours,
    }


@router.get("/zones")
def list_zones(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    return db.query(Zone).all()

@router.delete("/zones/delete/{zone_id}")
def delete_zone(zone_id: str, db: Session = Depends(get_db)):

    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if zone:

        db.delete(zone)
        db.commit()

@router.post("/zones", status_code=201)
def create_zone(
    # payload: ZoneCreateRequest,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    name = payload.get("name")
    description = payload.get("description")
    is_active = payload.get("is_active")
    if not name:
        raise HTTPException(status_code=400, detail="Zone name is required")
    
    existing = db.query(Zone).filter(Zone.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Zone name already exists")
    
    zone = Zone(name=name, description=description)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


@router.get("/branches")
def list_branches_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    branches = db.query(Branch).all()
    return [
        {
            "id": str(b.id),
            "name": b.name,
            "address": b.address,
            "zone_id": str(b.zone_id) if b.zone_id else None,
            "zone_name": b.zone.name if b.zone else None,
            "status": b.status
        }
        for b in branches
    ]


@router.post("/branches", status_code=201)
def create_branch(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    name = payload.get("name")
    address = payload.get("address")
    zone_id = payload.get("zone_id")
    if not name:
        raise HTTPException(status_code=400, detail="Branch name is required")
    
    branch = Branch(name=name, address=address, zone_id=zone_id)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch
