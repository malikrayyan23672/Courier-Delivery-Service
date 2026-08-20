import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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
from app.models.hub import Hub
from app.models.local_office import LocalOffice
from app.models.settlement import Settlement, SettlementStatus
from app.schemas.order import OrderOut, OrderDetailOut, AddressOut, TrackingEventOut, PaymentOut, RiderContactOut
from app.schemas.auth import AdminCreateUserRequest
from app.schemas.user import UserOut
from app.schemas.zone import ZoneOut
from app.schemas.zone import ZoneCreateRequest
from app.schemas.rider import RiderLocationOut
from app.services.order_service import transition, cancel_order
from app.models.delivery_attempt import DeliveryAttempt
from app.services.settlement_service import pending_cod_amount, rider_wallet_limit, rider_wallet_warning_at
from app.services import log_service
from app.services import notification_service
from app.core.scope import resolve_city_branch_ids

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/orders", response_model=list[OrderOut])
def list_all_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    scope = resolve_city_branch_ids(current_user, db)
    query = db.query(Order).order_by(Order.created_at.desc())
    if scope is not None:
        query = query.filter(Order.branch_id.in_(scope))
    return query.limit(200).all()


@router.get("/orders/{order_id}", response_model=OrderDetailOut)
def get_order_detail(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Full detail behind the Orders table's "View" action - previously a
    dead link to a page that didn't exist (`/admin/orders/{id}`)."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    scope = resolve_city_branch_ids(current_user, db)
    if scope is not None and (not order.branch_id or str(order.branch_id) not in scope):
        raise HTTPException(status_code=403, detail="This order belongs to a different city")

    rider_contact = None
    if order.rider and order.rider.user:
        rider_contact = RiderContactOut(
            full_name=order.rider.user.full_name,
            phone=order.rider.user.phone,
            vehicle_type=order.rider.vehicle_type,
            rating=order.rider.rating,
            current_lat=order.rider.current_lat,
            current_lng=order.rider.current_lng,
        )

    return OrderDetailOut(
        id=str(order.id),
        tracking_number=order.tracking_number,
        status=order.status,
        booking_channel=order.booking_channel,
        pickup_address=AddressOut.model_validate(order.pickup_address) if order.pickup_address else None,
        dropoff_address=AddressOut.model_validate(order.dropoff_address) if order.dropoff_address else None,
        package_weight_kg=order.package_weight_kg,
        package_description=order.package_description,
        estimated_price=order.estimated_price,
        final_price=order.final_price,
        discount_id=str(order.discount_id) if order.discount_id else None,
        discount_amount=order.discount_amount,
        rider_accepted=order.rider_accepted,
        branch_name=order.branch_name,
        branch_address=order.branch_address,
        branch_phone=order.branch_phone,
        created_at=order.created_at,
        proof_of_delivery_url=order.proof_of_delivery_url,
        proof_of_delivery_recipient_name=order.proof_of_delivery_recipient_name,
        product_id=str(order.product_id) if order.product_id else None,
        quantity=order.quantity,
        unit_price=order.unit_price,
        tracking_events=[TrackingEventOut.model_validate(e) for e in order.tracking_events],
        payment=PaymentOut.model_validate(order.payment) if order.payment else None,
        rider=rider_contact,
        failed_attempt_count=db.query(DeliveryAttempt).filter(DeliveryAttempt.order_id == order.id).count(),
        customer_name=order.customer.full_name if order.customer else None,
        customer_phone=order.customer.phone if order.customer else None,
    )


class OrderCancelIn(BaseModel):
    reason: Optional[str] = None


@router.patch("/orders/{order_id}/cancel", response_model=OrderOut)
def cancel_order_admin(
    order_id: str,
    payload: OrderCancelIn = OrderCancelIn(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Admin override - can cancel any order regardless of who booked it,
    same eligibility window as the customer/seller self-service cancel
    (before the parcel enters the hub network)."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    cancel_order(db, order, actor=current_user, reason=payload.reason)
    db.commit()
    db.refresh(order)
    return order


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

    # Unlike staff_assign_rider (which is scoped to the staff member's own
    # branch/zone), admin/super_admin can assign across zones by design -
    # this is the escalation path for when a zone has no available rider.
    # That's deliberate, but it should never be silent, so a cross-zone
    # assignment is audited here instead of being blocked.
    rider_zone_id = rider.branch.zone_id if rider.branch else None
    if order.zone_id and rider_zone_id and rider_zone_id != order.zone_id:
        log_service.create_log(
            db,
            action="admin_cross_zone_rider_assign",
            user_id=str(current_user.id),
            entity_type="Order",
            entity_id=str(order.id),
            details=f"Rider {rider.id} (zone {rider_zone_id}) assigned to order in zone {order.zone_id} - cross-zone admin override",
        )

    order.rider_id = rider.id
    order.rider_accepted = None
    transition(db, order, OrderStatus.assigned, actor=current_user, note=f"Assigned to rider {rider_id}")
    notification_service.notify(
        db,
        user_id=rider.user_id,
        title="New pickup offer",
        message=f"Order {order.tracking_number} assigned to you",
        order_id=order.id,
    )
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


@router.get("/riders/locations", response_model=list[RiderLocationOut])
def list_all_rider_locations(
    zone_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Live rider positions for the admin Live Map - unscoped by default
    (admin is deliberately cross-zone by design), with an optional
    ?zone_id= filter to narrow to a single zone."""
    query = (
        db.query(RiderProfile)
        .filter(
            RiderProfile.status == RiderStatus.active,
            RiderProfile.current_lat.isnot(None),
            RiderProfile.current_lng.isnot(None),
        )
    )
    if zone_id:
        query = query.join(Branch, RiderProfile.branch_id == Branch.id).filter(Branch.zone_id == zone_id)

    riders = query.all()

    return [
        RiderLocationOut(
            rider_id=str(r.id),
            full_name=r.user.full_name,
            lat=r.current_lat,
            lng=r.current_lng,
            is_available=r.is_available or False,
            vehicle_type=r.vehicle_type,
            rating=r.rating,
        )
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


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Generates a new random password for a staff/rider/admin account and
    returns it once, in the clear, for the admin to relay to the user out of
    band - there's no email/SMS channel wired up in this environment (see
    order_service.get_or_create_guest_customer for the same tradeoff), so
    this mirrors that rather than pretending a reset-link email goes out."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    temp_password = secrets.token_urlsafe(9)
    user.hashed_password = hash_password(temp_password)
    db.commit()

    log_service.create_log(
        db,
        action="admin_reset_password",
        user_id=str(current_user.id),
        entity_type="User",
        entity_id=str(user.id),
        details=f"Password reset for {user.full_name} ({user.email})",
    )

    return {"id": str(user.id), "full_name": user.full_name, "temporary_password": temp_password}


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
    elif payload.role == "manager":
        db.add(StaffProfile(user_id=user.id, branch_id=payload.branch_id, designation=payload.designation))
        branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()

        if not branch:
            raise HTTPException(status_code=400, detail='branch could not found')

        branch.manager_id = user.id
        db.commit()
    elif payload.role == "admin" and payload.branch_id:
        # A per-branch admin (scoped to their own city by resolve_city_branch_ids,
        # see app/core/scope.py) - optional, since an admin created without a
        # branch_id stays the network-wide oversight admin this role has always
        # meant, for backward compatibility with accounts created before Hub/
        # LocalOffice existed. `branch.admin_id` is the branch's single
        # designated admin, mirroring hub_manager/local_office_manager below.
        branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
        if not branch:
            raise HTTPException(status_code=400, detail='branch could not found')
        db.add(StaffProfile(user_id=user.id, branch_id=payload.branch_id, designation=payload.designation))
        branch.admin_id = user.id
        db.commit()
    elif payload.role == "hub_manager":
        if not payload.hub_id:
            raise HTTPException(status_code=400, detail="hub_id is required for a hub_manager account")
        hub = db.query(Hub).filter(Hub.id == payload.hub_id).first()
        if not hub:
            raise HTTPException(status_code=400, detail="Hub not found")

        db.add(StaffProfile(user_id=user.id, branch_id=hub.branch_id, hub_id=hub.id, designation=payload.designation))
        hub.manager_id = user.id
        db.commit()
    elif payload.role == "local_office_manager":
        if not payload.local_office_id:
            raise HTTPException(status_code=400, detail="local_office_id is required for a local_office_manager account")
        office = db.query(LocalOffice).filter(LocalOffice.id == payload.local_office_id).first()
        if not office:
            raise HTTPException(status_code=400, detail="Local office not found")

        # branch_id/hub_id are both derived from the office's hub - the
        # office -> hub -> branch chain, so this account inherits scope at
        # every layer above it (see app/core/scope.py).
        db.add(StaffProfile(
            user_id=user.id, branch_id=office.hub.branch_id, hub_id=office.hub_id,
            local_office_id=office.id, designation=payload.designation,
        ))
        office.manager_id = user.id
        db.commit()

    db.commit()
    db.refresh(user)

    return UserOut.from_orm_with_role(user)


def _period_network_stats(db: Session, start: datetime, end: datetime) -> dict:
    """Delivery success rate, on-time pickup rate, and rider utilization for one
    time window - powers the superadmin week-over-week comparison."""
    from app.api.v1.hub import ON_TIME_PICKUP_HOURS

    status_rows = (
        db.query(Order.status, func.count(Order.id))
        .filter(
            Order.status.in_([OrderStatus.delivered, OrderStatus.failed, OrderStatus.rto]),
            Order.created_at >= start,
            Order.created_at < end,
        )
        .group_by(Order.status)
        .all()
    )
    counts = {s: c for s, c in status_rows}
    delivered = counts.get(OrderStatus.delivered, 0)
    resolved = sum(counts.values())
    delivery_success_rate = round((delivered / resolved) * 100, 1) if resolved else 0.0

    pickup_rows = (
        db.query(Order.id, Order.created_at, func.min(TrackingEvent.created_at))
        .join(TrackingEvent, TrackingEvent.order_id == Order.id)
        .filter(
            TrackingEvent.status == OrderStatus.picked_up.value,
            Order.created_at >= start,
            Order.created_at < end,
        )
        .group_by(Order.id, Order.created_at)
        .all()
    )
    on_time = sum(
        1 for _, created, picked in pickup_rows
        if picked and (picked - created) <= timedelta(hours=ON_TIME_PICKUP_HOURS)
    )
    on_time_pickup_rate = round((on_time / len(pickup_rows)) * 100, 1) if pickup_rows else 0.0

    active_rider_ids = {
        str(r) for (r,) in (
            db.query(Order.rider_id)
            .filter(
                Order.status == OrderStatus.delivered,
                Order.rider_id.isnot(None),
                Order.created_at >= start,
                Order.created_at < end,
            )
            .distinct()
            .all()
        )
    }
    total_riders = db.query(func.count(RiderProfile.id)).scalar() or 0
    rider_utilization = round((len(active_rider_ids) / total_riders) * 100, 1) if total_riders else 0.0

    return {
        "delivery_success_rate": delivery_success_rate,
        "on_time_pickup_rate": on_time_pickup_rate,
        "rider_utilization": rider_utilization,
    }


def _network_comparison(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    this_week_start = now - timedelta(days=7)
    last_week_start = now - timedelta(days=14)
    return {
        "this_week": _period_network_stats(db, this_week_start, now),
        "last_week": _period_network_stats(db, last_week_start, this_week_start),
    }


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
        "network_comparison": _network_comparison(db),
    }


@router.get("/riders/leaderboard")
def rider_leaderboard(
    days: int = 30,
    sort_by: str = "deliveries",  # deliveries | earnings | success_rate
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Full network-wide rider ranking, not just the dashboard's top-5 -
    deliveries, earnings, and success rate (delivered vs delivered+rto) over
    a selectable window."""
    days = max(1, min(days, 365))
    since = datetime.now(timezone.utc) - timedelta(days=days)

    outcome_rows = (
        db.query(RiderProfile.id, Order.status, func.count(Order.id), func.sum(Order.final_price))
        .join(Order, Order.rider_id == RiderProfile.id)
        .filter(Order.status.in_([OrderStatus.delivered, OrderStatus.rto]), Order.updated_at >= since)
        .group_by(RiderProfile.id, Order.status)
        .all()
    )

    by_rider: dict[str, dict] = {}
    for rider_id, status, count, revenue in outcome_rows:
        bucket = by_rider.setdefault(str(rider_id), {"delivered": 0, "rto": 0, "earnings": 0.0})
        if status == OrderStatus.delivered:
            bucket["delivered"] = count
            bucket["earnings"] = round(revenue or 0.0, 2)
        else:
            bucket["rto"] = count

    if not by_rider:
        return []

    riders = (
        db.query(RiderProfile)
        .options(joinedload(RiderProfile.user))
        .filter(RiderProfile.id.in_(by_rider.keys()))
        .all()
    )
    rows = []
    for rider in riders:
        stats = by_rider[str(rider.id)]
        total = stats["delivered"] + stats["rto"]
        rows.append({
            "rider_id": str(rider.id),
            "full_name": rider.user.full_name if rider.user else "Unknown",
            "branch_name": rider.branch.name if rider.branch else None,
            "rating": rider.rating,
            "deliveries": stats["delivered"],
            "rto_count": stats["rto"],
            "earnings": stats["earnings"],
            "success_rate": round((stats["delivered"] / total) * 100, 1) if total else 0.0,
        })

    sort_key = sort_by if sort_by in ("deliveries", "earnings", "success_rate") else "deliveries"
    rows.sort(key=lambda r: r[sort_key], reverse=True)
    return rows


def _zone_out(db: Session, zone: Zone) -> dict:
    branch_count = db.query(func.count(Branch.id)).filter(Branch.zone_id == zone.id).scalar() or 0
    active_branch_count = (
        db.query(func.count(Branch.id)).filter(Branch.zone_id == zone.id, Branch.status == "active").scalar() or 0
    )
    return {
        "id": str(zone.id),
        "name": zone.name,
        "description": zone.description,
        "is_active": zone.is_active,
        "base_rate": zone.base_rate,
        "cod_fee_percentage": zone.cod_fee_percentage,
        "branch_count": branch_count,
        # A zone with zero active branches can never be matched to a rider/hub
        # at booking time (order_service.create_order requires an active
        # Branch in the zone) - orders still get created, just unrouted. This
        # is what the "add a city" flow exists to prevent.
        "is_live": active_branch_count > 0,
    }


@router.get("/zones")
def list_zones(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    return [_zone_out(db, z) for z in db.query(Zone).order_by(Zone.name).all()]


@router.delete("/zones/delete/{zone_id}")
def delete_zone(
    zone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    # SQLAlchemy would otherwise silently null out zone_id on every branch
    # that references this zone (passive_deletes isn't set) rather than
    # blocking or cascading - quietly un-routing a whole city's branches.
    branch_count = db.query(func.count(Branch.id)).filter(Branch.zone_id == zone_id).scalar() or 0
    if branch_count:
        raise HTTPException(
            status_code=400,
            detail=f"This city still has {branch_count} branch(es) - reassign or remove them first.",
        )
    db.delete(zone)
    db.commit()


@router.post("/zones", status_code=201)
def create_zone(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Zone name is required")

    # Case-insensitive, matching how every booking/pricing lookup actually
    # matches a city (func.lower(Zone.name) == func.lower(address.city)) -
    # an exact-match-only check here let "Lahore" and "lahore" coexist as two
    # rows that lookup code can then pick between arbitrarily.
    existing = db.query(Zone).filter(func.lower(Zone.name) == name.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="A zone with this city name already exists")

    zone = Zone(
        name=name,
        description=payload.get("description"),
        is_active=payload.get("is_active", True),
        base_rate=payload.get("base_rate") or 5.0,
        cod_fee_percentage=payload.get("cod_fee_percentage") or 3.0,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return _zone_out(db, zone)


class AddCityRequest(BaseModel):
    """Bundles what a city actually needs to be bookable in one step: the
    Zone that lets addresses in that city match a service area, and at
    least one active Branch in it - a Zone alone routes nothing (see
    order_service.create_order)."""
    city_name: str
    description: Optional[str] = None
    base_rate: Optional[float] = None
    cod_fee_percentage: Optional[float] = None
    branch_name: str
    branch_address: Optional[str] = None
    branch_phone: Optional[str] = None
    branch_email: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None


@router.post("/cities", status_code=201)
def add_city(
    payload: AddCityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Single entry point for "add a new city" - creates the Zone and its
    first Branch together, atomically, so a city can never end up half-set-up
    (a Zone nobody can book through, or a Branch nothing points a customer
    at). Pricing (base_rate/cod_fee_percentage) is taken here too since it
    already lives on the Zone row; per-weight pricing slabs and inter-city
    corridors are separate, deliberately not bundled here (see
    /admin/pricing/rules and /admin/corridors) - they're pairwise/optional,
    not part of making one city live."""
    city_name = payload.city_name.strip()
    if not city_name:
        raise HTTPException(status_code=400, detail="City name is required")
    branch_name = payload.branch_name.strip()
    if not branch_name:
        raise HTTPException(status_code=400, detail="Branch name is required")

    existing = db.query(Zone).filter(func.lower(Zone.name) == city_name.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="A zone with this city name already exists")

    zone = Zone(
        name=city_name,
        description=payload.description,
        is_active=True,
        base_rate=payload.base_rate or 5.0,
        cod_fee_percentage=payload.cod_fee_percentage or 3.0,
    )
    db.add(zone)
    db.flush()  # need zone.id for the branch FK, before committing either

    branch = Branch(
        name=branch_name,
        address=payload.branch_address,
        phone=payload.branch_phone,
        email=payload.branch_email,
        opening_time=payload.opening_time,
        closing_time=payload.closing_time,
        latitude=payload.latitude,
        longitude=payload.longitude,
        zone_id=zone.id,
        status="active",
    )
    db.add(branch)
    db.commit()
    db.refresh(zone)
    db.refresh(branch)

    log_service.create_log(
        db, action="admin_add_city", user_id=str(current_user.id),
        entity_type="Zone", entity_id=str(zone.id),
        details=f"Added city '{city_name}' with branch '{branch_name}'",
    )

    return {"zone": _zone_out(db, zone), "branch": _branch_out(branch)}


def _branch_out(b: Branch) -> dict:
    return {
        "id": str(b.id),
        "name": b.name,
        "address": b.address,
        "phone": b.phone,
        "email": b.email,
        "opening_time": b.opening_time,
        "closing_time": b.closing_time,
        "latitude": b.latitude,
        "longitude": b.longitude,
        "zone_id": str(b.zone_id) if b.zone_id else None,
        "zone_name": b.zone.name if b.zone else None,
        "status": b.status,
        "admin_id": str(b.admin_id) if b.admin_id else None,
        "admin_name": b.admin.full_name if b.admin else None,
    }


@router.get("/branches")
def list_branches_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    branches = db.query(Branch).order_by(Branch.name).all()
    return [_branch_out(b) for b in branches]


@router.post("/branches", status_code=201)
def create_branch(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Branch name is required")

    branch = Branch(
        name=name,
        address=payload.get("address"),
        zone_id=payload.get("zone_id") or None,
        phone=payload.get("phone"),
        email=payload.get("email"),
        opening_time=payload.get("opening_time"),
        closing_time=payload.get("closing_time"),
        latitude=payload.get("latitude"),
        longitude=payload.get("longitude"),
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return _branch_out(branch)


@router.patch("/branches/{branch_id}")
def update_branch(
    branch_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    if "name" in payload and not payload["name"]:
        raise HTTPException(status_code=400, detail="Branch name cannot be empty")

    # Whitelisted, partial update - only touches fields the caller actually sent.
    for field in ("name", "address", "phone", "email", "opening_time", "closing_time", "zone_id", "latitude", "longitude"):
        if field in payload:
            setattr(branch, field, payload[field] or None)
    if "status" in payload:
        if payload["status"] not in ("active", "inactive"):
            raise HTTPException(status_code=400, detail="Status must be 'active' or 'inactive'")
        branch.status = payload["status"]

    db.commit()
    db.refresh(branch)
    return _branch_out(branch)


# ============================================================
# HUBS (sorting/scan facilities under a branch)
# ============================================================
def _hub_out(h: Hub) -> dict:
    return {
        "id": str(h.id),
        "name": h.name,
        "address": h.address,
        "phone": h.phone,
        "status": h.status,
        "branch_id": str(h.branch_id),
        "branch_name": h.branch.name if h.branch else None,
        "manager_id": str(h.manager_id) if h.manager_id else None,
        "manager_name": h.manager.full_name if h.manager else None,
    }


@router.get("/hubs")
def list_hubs_admin(
    branch_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    query = db.query(Hub).order_by(Hub.name)
    if branch_id:
        query = query.filter(Hub.branch_id == branch_id)
    return [_hub_out(h) for h in query.all()]


@router.post("/hubs", status_code=201)
def create_hub(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    name = payload.get("name")
    branch_id = payload.get("branch_id")
    if not name:
        raise HTTPException(status_code=400, detail="Hub name is required")
    if not branch_id:
        raise HTTPException(status_code=400, detail="branch_id is required")
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    hub = Hub(name=name, address=payload.get("address"), phone=payload.get("phone"), branch_id=branch_id)
    db.add(hub)
    db.commit()
    db.refresh(hub)
    return _hub_out(hub)


@router.patch("/hubs/{hub_id}")
def update_hub(
    hub_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    hub = db.query(Hub).filter(Hub.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")

    if "name" in payload and not payload["name"]:
        raise HTTPException(status_code=400, detail="Hub name cannot be empty")
    for field in ("name", "address", "phone"):
        if field in payload:
            setattr(hub, field, payload[field] or None)
    if "status" in payload:
        if payload["status"] not in ("active", "inactive"):
            raise HTTPException(status_code=400, detail="Status must be 'active' or 'inactive'")
        hub.status = payload["status"]

    db.commit()
    db.refresh(hub)
    return _hub_out(hub)


# ============================================================
# LOCAL OFFICES (guest walk-in booking counters under a hub)
# ============================================================
def _local_office_out(o: LocalOffice) -> dict:
    return {
        "id": str(o.id),
        "name": o.name,
        "address": o.address,
        "phone": o.phone,
        "status": o.status,
        "hub_id": str(o.hub_id),
        "hub_name": o.hub.name if o.hub else None,
        "branch_id": str(o.hub.branch_id) if o.hub else None,
        "branch_name": o.hub.branch.name if o.hub and o.hub.branch else None,
        "manager_id": str(o.manager_id) if o.manager_id else None,
        "manager_name": o.manager.full_name if o.manager else None,
    }


@router.get("/local-offices")
def list_local_offices_admin(
    branch_id: str | None = None,
    hub_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    query = db.query(LocalOffice).order_by(LocalOffice.name)
    if hub_id:
        query = query.filter(LocalOffice.hub_id == hub_id)
    elif branch_id:
        # No branch_id column on LocalOffice any more - join through its hub.
        query = query.join(Hub, LocalOffice.hub_id == Hub.id).filter(Hub.branch_id == branch_id)
    return [_local_office_out(o) for o in query.all()]


@router.post("/local-offices", status_code=201)
def create_local_office(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    name = payload.get("name")
    hub_id = payload.get("hub_id")
    if not name:
        raise HTTPException(status_code=400, detail="Local office name is required")
    if not hub_id:
        raise HTTPException(status_code=400, detail="hub_id is required")
    hub = db.query(Hub).filter(Hub.id == hub_id).first()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")

    office = LocalOffice(name=name, address=payload.get("address"), phone=payload.get("phone"), hub_id=hub_id)
    db.add(office)
    db.commit()
    db.refresh(office)
    return _local_office_out(office)


@router.patch("/local-offices/{local_office_id}")
def update_local_office(
    local_office_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    office = db.query(LocalOffice).filter(LocalOffice.id == local_office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Local office not found")

    if "name" in payload and not payload["name"]:
        raise HTTPException(status_code=400, detail="Local office name cannot be empty")
    if "hub_id" in payload:
        new_hub = db.query(Hub).filter(Hub.id == payload["hub_id"]).first()
        if not new_hub:
            raise HTTPException(status_code=400, detail="Hub not found")
        office.hub_id = payload["hub_id"]
    for field in ("name", "address", "phone"):
        if field in payload:
            setattr(office, field, payload[field] or None)
    if "status" in payload:
        if payload["status"] not in ("active", "inactive"):
            raise HTTPException(status_code=400, detail="Status must be 'active' or 'inactive'")
        office.status = payload["status"]

    db.commit()
    db.refresh(office)
    return _local_office_out(office)
