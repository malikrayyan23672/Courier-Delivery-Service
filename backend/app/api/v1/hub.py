from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.order import Order, OrderStatus
from app.models.rider import RiderProfile, RiderStatus
from app.models.tracking_event import TrackingEvent
from app.models.delivery_attempt import DeliveryAttempt
from app.models.bus_network import BusManifest, BusSchedule, ManifestItem, ManifestStatus
from app.models.staff import StaffProfile
from app.models.branch_service_area import BranchServiceArea
from app.models.settlement import Settlement
from app.models.support_ticket import SupportTicket
from app.models.branch import Branch
from app.services.order_service import transition, offer_last_mile_rider, handle_dest_hub_arrival
from app.services.settlement_service import (
    rider_wallet_limit,
    rider_wallet_warning_at,
    lock_rider_wallet,
    unlock_rider_wallet,
    set_rider_wallet_limit,
)

router = APIRouter(prefix="/hub", tags=["Hub Operations"])

# Branch console access: branch staff, branch managers, and admin oversight.
HUB_ROLES = ("staff", "admin", "super_admin", "manager")


def _resolve_branch_id(current_user: User, branch_id: str | None) -> str:
    """Staff are always scoped to their own branch. Admin/super_admin can pass
    ?branch_id= to inspect any branch (oversight), matching the branch console's
    existing 'staff, admin, super_admin' access pattern."""
    role_name = current_user.role.name if current_user.role else None
    if role_name in ("admin", "super_admin") and branch_id:
        return branch_id

    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.branch_id:
        raise HTTPException(status_code=400, detail="You must belong to a branch to use hub operations")
    return str(staff_profile.branch_id)


def _order_summary(order: Order) -> dict:
    return {
        "id": str(order.id),
        "tracking_number": order.tracking_number,
        "status": order.status.value if hasattr(order.status, "value") else order.status,
        "package_description": order.package_description,
        "dropoff_city": order.dropoff_address.city if order.dropoff_address else None,
        "updated_at": order.updated_at,
    }


def _rider_wallet_out(rider: RiderProfile) -> dict:
    return {
        "rider_id": str(rider.id),
        "full_name": rider.user.full_name if rider.user else "Unknown",
        "phone": rider.user.phone if rider.user else None,
        "cod_cash_held": round(rider.cod_cash_held or 0.0, 2),
        "cod_wallet_locked": rider.cod_wallet_locked or False,
        "wallet_limit": rider_wallet_limit(rider),
        "wallet_warning_at": rider_wallet_warning_at(rider),
    }


class RiderWalletUpdateIn(BaseModel):
    action: Literal["lock", "unlock", "set_limit"]
    note: Optional[str] = None
    wallet_limit: Optional[float] = None


def _vendor_scores(db: Session, branch_id: str) -> list[dict]:
    manifests = (
        db.query(BusManifest)
        .join(BusSchedule, BusManifest.schedule_id == BusSchedule.id)
        .options(joinedload(BusManifest.schedule).joinedload(BusSchedule.operator))
        .filter(BusSchedule.origin_branch_id == branch_id, BusManifest.status != ManifestStatus.in_preparation)
        .all()
    )
    scores: dict[str, dict] = {}
    for m in manifests:
        if not m.schedule or not m.schedule.operator:
            continue
        op = m.schedule.operator
        entry = scores.setdefault(str(op.id), {"operator_id": str(op.id), "operator_name": op.name, "total": 0, "on_time": 0})
        entry["total"] += 1
        # No dedicated "actual departure" timestamp exists yet - approximated via
        # the manifest row's updated_at, which changes when its status flips to
        # in_transit. Good enough for a directional on-time score, not exact to
        # the second.
        if m.departure_at and m.updated_at and m.updated_at <= m.departure_at + timedelta(minutes=15):
            entry["on_time"] += 1
    return [
        {**v, "on_time_pct": round((v["on_time"] / v["total"]) * 100, 1) if v["total"] else 0.0}
        for v in scores.values()
    ]


@router.get("/inbound-queue")
def inbound_queue(
    branch_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    """Parcels picked up and routed through this branch, not yet scanned in at the hub."""
    bid = _resolve_branch_id(current_user, branch_id)
    orders = (
        db.query(Order)
        .options(joinedload(Order.dropoff_address))
        .filter(Order.branch_id == bid, Order.status == OrderStatus.picked_up)
        .order_by(Order.updated_at.asc())
        .all()
    )
    return [_order_summary(o) for o in orders]


@router.post("/inbound/scan")
def inbound_scan(
    tracking_number: str,
    branch_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    """The hub receiving scan: PICKED -> IN_HUB."""
    bid = _resolve_branch_id(current_user, branch_id)
    order = db.query(Order).filter(Order.tracking_number == tracking_number.strip().upper()).first()
    if not order:
        raise HTTPException(status_code=404, detail="No parcel found with that tracking number")

    transition(db, order, OrderStatus.in_hub, actor=current_user, note=f"Scanned in at hub (branch {bid})")
    db.commit()
    db.refresh(order)
    return _order_summary(order)


# Each action is what the scanner physically observed, and maps to exactly one
# legal edge of the state machine. `transition()` rejects a scan that doesn't
# match the parcel's current status, so a hub can't accidentally double-scan.
_SCAN_ACTIONS = {
    # action -> (target status, tracking note)
    "in": (OrderStatus.in_hub, "received at this hub (picked -> in_hub)"),
    "out": (OrderStatus.in_transit, "departed this branch on the bus network (in_hub -> in_transit)"),
    "arrive": (OrderStatus.dest_hub, "arrived at destination hub (in_transit -> dest_hub)"),
}


@router.post("/scan")
def hub_scan(
    tracking_number: str,
    action: str = Query("in", pattern="^(in|out|arrive)$"),
    branch_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    """
    The hub scanner. One endpoint drives a parcel through the bus network:
      - in     -> IN_HUB       (received at this hub)
      - out    -> IN_TRANSIT   (out of this branch, on the bus)
      - arrive -> DEST_HUB     (arrived at the destination hub)
    Returns the parcel with its new status so the console can show the result.
    """
    bid = _resolve_branch_id(current_user, branch_id)
    order = db.query(Order).filter(Order.tracking_number == tracking_number.strip().upper()).first()
    if not order:
        raise HTTPException(status_code=404, detail="No parcel found with that tracking number")

    target, note = _SCAN_ACTIONS[action]
    transition(db, order, target, actor=current_user, note=f"Scanned {action} - {note} (branch {bid})")
    if action == "arrive":
        handle_dest_hub_arrival(db, order, bid, actor=current_user)
    db.commit()
    db.refresh(order)
    return {**_order_summary(order), "scan_action": action, "note": f"Scanned {action} - {note} (branch {bid})"}


@router.get("/dispatch-queue")
def dispatch_queue(
    branch_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    """Parcels scanned in at this branch, ready to be loaded onto an outbound manifest."""
    bid = _resolve_branch_id(current_user, branch_id)
    orders = (
        db.query(Order)
        .options(joinedload(Order.dropoff_address))
        .filter(Order.branch_id == bid, Order.status == OrderStatus.in_hub)
        .order_by(Order.updated_at.asc())
        .all()
    )
    return [_order_summary(o) for o in orders]


@router.get("/manifest-history")
def manifest_history(
    branch_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    bid = _resolve_branch_id(current_user, branch_id)
    manifests = (
        db.query(BusManifest)
        .join(BusSchedule, BusManifest.schedule_id == BusSchedule.id, isouter=True)
        .options(
            joinedload(BusManifest.schedule).joinedload(BusSchedule.operator),
            joinedload(BusManifest.items).joinedload(ManifestItem.order),
        )
        .filter((BusSchedule.origin_branch_id == bid) | (BusSchedule.destination_branch_id == bid))
        .order_by(BusManifest.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": str(m.id),
            "manifest_number": m.manifest_number,
            "coach_number": m.coach_number,
            "status": m.status.value if hasattr(m.status, "value") else m.status,
            "departure_at": m.departure_at,
            "origin_city": m.origin_city,
            "destination_city": m.destination_city,
            "item_count": len(m.items),
            "operator_name": m.schedule.operator.name if m.schedule and m.schedule.operator else None,
            # Whether this hub is the manifest's origin (loading/dispatching it)
            # or its destination (expecting it to arrive) - lets the hub console
            # split "Outbound" from "Arrivals" without a second round trip.
            "direction": "outbound" if m.schedule and str(m.schedule.origin_branch_id) == bid else "inbound",
            "items": [
                {
                    "id": str(i.id),
                    "order_id": str(i.order_id) if i.order_id else None,
                    "crate_label": i.crate_label,
                    "scan_status": i.scan_status.value if hasattr(i.scan_status, "value") else i.scan_status,
                    "tracking_number": i.order.tracking_number if i.order else None,
                }
                for i in m.items
            ],
        }
        for m in manifests
    ]


@router.get("/rto-queue")
def rto_queue(
    branch_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    """Parcels at this branch that exhausted delivery attempts and are awaiting a return dispatch."""
    bid = _resolve_branch_id(current_user, branch_id)
    orders = (
        db.query(Order)
        .options(joinedload(Order.dropoff_address))
        .filter(Order.branch_id == bid, Order.status == OrderStatus.rto)
        .order_by(Order.updated_at.desc())
        .all()
    )
    rows = []
    for o in orders:
        summary = _order_summary(o)
        last_attempt = (
            db.query(DeliveryAttempt)
            .filter(DeliveryAttempt.order_id == o.id)
            .order_by(DeliveryAttempt.attempt_number.desc())
            .first()
        )
        summary["failure_note"] = last_attempt.notes if last_attempt else None
        summary["failure_photo_url"] = last_attempt.photo_url if last_attempt else None
        rows.append(summary)
    return rows


@router.get("/aging-parcels")
def aging_parcels(
    branch_id: str | None = Query(None),
    hours: float = Query(4.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    bid = _resolve_branch_id(current_user, branch_id)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    orders = (
        db.query(Order)
        .options(joinedload(Order.dropoff_address))
        .filter(
            Order.branch_id == bid,
            Order.status.in_([OrderStatus.in_hub, OrderStatus.dest_hub]),
            Order.updated_at <= cutoff,
        )
        .order_by(Order.updated_at.asc())
        .all()
    )
    now = datetime.now(timezone.utc)
    return [
        {**_order_summary(o), "hours_aging": round((now - o.updated_at).total_seconds() / 3600, 1)}
        for o in orders
    ]


@router.get("/vendor-scores")
def vendor_scores(
    branch_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    bid = _resolve_branch_id(current_user, branch_id)
    return _vendor_scores(db, bid)


# No explicit delivery SLA field exists yet, so "on time" is approximated as
# picked up within this many hours of the order being created.
ON_TIME_PICKUP_HOURS = 4


def _delivery_success_rate(db: Session, since: datetime, branch_id: str | None = None) -> float:
    query = db.query(Order.status, func.count(Order.id)).filter(
        Order.status.in_([OrderStatus.delivered, OrderStatus.failed, OrderStatus.rto]),
        Order.created_at >= since,
    )
    if branch_id:
        query = query.filter(Order.branch_id == branch_id)
    counts = {s: c for s, c in query.group_by(Order.status).all()}
    delivered = counts.get(OrderStatus.delivered, 0)
    resolved = sum(counts.values())
    return round((delivered / resolved) * 100, 1) if resolved else 0.0


def _on_time_pickup_rate(db: Session, since: datetime, branch_id: str | None = None) -> float:
    query = (
        db.query(Order.id, Order.created_at, func.min(TrackingEvent.created_at))
        .join(TrackingEvent, TrackingEvent.order_id == Order.id)
        .filter(TrackingEvent.status == OrderStatus.picked_up.value, Order.created_at >= since)
    )
    if branch_id:
        query = query.filter(Order.branch_id == branch_id)
    rows = query.group_by(Order.id, Order.created_at).all()
    if not rows:
        return 0.0
    on_time = sum(
        1 for _, created, picked in rows
        if picked and (picked - created) <= timedelta(hours=ON_TIME_PICKUP_HOURS)
    )
    return round((on_time / len(rows)) * 100, 1)


def _hub_reports(db: Session, bid: str) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=30)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    avg_delivery_seconds = (
        db.query(func.avg(func.extract("epoch", Order.updated_at - Order.created_at)))
        .filter(Order.branch_id == bid, Order.status == OrderStatus.delivered)
        .scalar()
    )

    cod_collected_today = (
        db.query(func.sum(Settlement.amount))
        .join(Order, Settlement.order_id == Order.id)
        .filter(Order.branch_id == bid, Settlement.created_at >= today_start)
        .scalar()
        or 0.0
    )

    complaints_7d = (
        db.query(func.count(SupportTicket.id))
        .join(Order, SupportTicket.order_id == Order.id)
        .filter(Order.branch_id == bid, SupportTicket.created_at >= week_ago)
        .scalar()
        or 0
    )

    branch_delivered_counts = (
        db.query(Order.branch_id, func.count(Order.id))
        .filter(Order.status == OrderStatus.delivered, Order.branch_id.isnot(None))
        .group_by(Order.branch_id)
        .order_by(func.count(Order.id).desc())
        .all()
    )
    ranked_branch_ids = [str(row[0]) for row in branch_delivered_counts]
    network_rank = ranked_branch_ids.index(bid) + 1 if bid in ranked_branch_ids else None
    network_branch_count = db.query(func.count(Branch.id)).scalar() or 0

    return {
        "delivery_success_rate": _delivery_success_rate(db, since, bid),
        "network_delivery_success_rate": _delivery_success_rate(db, since, None),
        "on_time_pickup_rate": _on_time_pickup_rate(db, since, bid),
        "network_on_time_pickup_rate": _on_time_pickup_rate(db, since, None),
        "avg_delivery_hours": round(avg_delivery_seconds / 3600, 1) if avg_delivery_seconds else None,
        "cod_collected_today": round(cod_collected_today, 2),
        "complaints_7d": complaints_7d,
        "network_rank": network_rank,
        "network_branch_count": network_branch_count,
    }


@router.get("/analytics")
def hub_analytics(
    branch_id: str | None = Query(None),
    days: int = Query(14),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    bid = _resolve_branch_id(current_user, branch_id)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    in_rows = (
        db.query(func.date(TrackingEvent.created_at), func.count(TrackingEvent.id))
        .join(Order, TrackingEvent.order_id == Order.id)
        .filter(
            Order.branch_id == bid,
            TrackingEvent.status == OrderStatus.in_hub.value,
            TrackingEvent.created_at >= since,
        )
        .group_by(func.date(TrackingEvent.created_at))
        .all()
    )
    out_rows = (
        db.query(func.date(TrackingEvent.created_at), func.count(TrackingEvent.id))
        .join(Order, TrackingEvent.order_id == Order.id)
        .filter(
            Order.branch_id == bid,
            TrackingEvent.status == OrderStatus.in_transit.value,
            TrackingEvent.created_at >= since,
        )
        .group_by(func.date(TrackingEvent.created_at))
        .all()
    )
    in_counts = {str(d): c for d, c in in_rows}
    out_counts = {str(d): c for d, c in out_rows}
    all_days = sorted(set(in_counts) | set(out_counts))

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    parcels_in_today = (
        db.query(func.count(TrackingEvent.id))
        .join(Order, TrackingEvent.order_id == Order.id)
        .filter(
            Order.branch_id == bid,
            TrackingEvent.status == OrderStatus.in_hub.value,
            TrackingEvent.created_at >= today_start,
        )
        .scalar()
        or 0
    )
    parcels_out_today = (
        db.query(func.count(TrackingEvent.id))
        .join(Order, TrackingEvent.order_id == Order.id)
        .filter(
            Order.branch_id == bid,
            TrackingEvent.status == OrderStatus.in_transit.value,
            TrackingEvent.created_at >= today_start,
        )
        .scalar()
        or 0
    )
    on_bus = (
        db.query(func.count(Order.id))
        .filter(Order.branch_id == bid, Order.status == OrderStatus.in_transit)
        .scalar()
        or 0
    )
    pending = (
        db.query(func.count(Order.id))
        .filter(Order.branch_id == bid, Order.status == OrderStatus.picked_up)
        .scalar()
        or 0
    )
    rto = (
        db.query(func.count(Order.id))
        .filter(Order.branch_id == bid, Order.status == OrderStatus.rto)
        .scalar()
        or 0
    )

    return {
        "daily": [
            {"date": d, "parcels_in": in_counts.get(d, 0), "parcels_out": out_counts.get(d, 0)}
            for d in all_days
        ],
        "vendor_scores": _vendor_scores(db, bid),
        "snapshot": {
            "parcels_in_today": parcels_in_today,
            "parcels_out_today": parcels_out_today,
            "on_bus": on_bus,
            "pending": pending,
            "rto": rto,
        },
        "reports": _hub_reports(db, bid),
    }


@router.patch("/riders/{rider_id}/wallet")
def rider_wallet_update(
    rider_id: str,
    payload: RiderWalletUpdateIn,
    db: Session = Depends(get_db),
    # Financial control - branch managers and admin oversight only, not staff.
    current_user: User = Depends(require_roles("manager", "admin", "super_admin")),
):
    """Branch manager controls a rider's COD wallet:
      - lock      freeze the wallet (over limit / hold) with an audit note
      - unlock    cash deposited at hub - clears the hold and cash-in-hand
      - set_limit adjust the rider's holding limit (tightening auto-locks)
    Every action is written to the audit log.
    """
    rider = db.query(RiderProfile).options(joinedload(RiderProfile.user)).filter(RiderProfile.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    bid = _resolve_branch_id(current_user, None)
    if rider.branch_id and str(rider.branch_id) != bid:
        raise HTTPException(status_code=403, detail="This rider does not belong to your branch")

    if payload.action == "lock":
        lock_rider_wallet(db, rider, locked_by=current_user, note=payload.note or "")
    elif payload.action == "unlock":
        if not rider.cod_wallet_locked and not rider.cod_cash_held:
            raise HTTPException(status_code=400, detail="This rider's wallet isn't locked or holding any cash")
        unlock_rider_wallet(db, rider, unlocked_by=current_user, note=payload.note or "Cash deposited at hub")
    else:  # set_limit
        set_rider_wallet_limit(db, rider, payload.wallet_limit, updated_by=current_user, note=payload.note)

    db.commit()
    db.refresh(rider)
    return _rider_wallet_out(rider)


# ============================================================
# BRANCH STAFF ROSTER
# ============================================================
def _staff_out(staff: StaffProfile) -> dict:
    return {
        "id": str(staff.id),
        "full_name": staff.user.full_name if staff.user else "Unknown",
        "designation": staff.designation,
        "employee_code": staff.employee_code,
        "phone": staff.user.phone if staff.user else None,
        "attendance_status": staff.attendance_status,
    }


@router.get("/staff")
def list_branch_staff(
    branch_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    bid = _resolve_branch_id(current_user, branch_id)
    staff = (
        db.query(StaffProfile)
        .options(joinedload(StaffProfile.user))
        .filter(StaffProfile.branch_id == bid)
        .all()
    )
    return [_staff_out(s) for s in staff]


class StaffAttendanceIn(BaseModel):
    status: Literal["present", "on_leave", "absent"]


@router.patch("/staff/{staff_profile_id}/attendance")
def update_staff_attendance(
    staff_profile_id: str,
    payload: StaffAttendanceIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin", "super_admin")),
):
    bid = _resolve_branch_id(current_user, None)
    staff = (
        db.query(StaffProfile)
        .options(joinedload(StaffProfile.user))
        .filter(StaffProfile.id == staff_profile_id)
        .first()
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    if str(staff.branch_id) != bid:
        raise HTTPException(status_code=403, detail="This staff member does not belong to your branch")

    staff.attendance_status = payload.status
    db.commit()
    db.refresh(staff)
    return _staff_out(staff)


# ============================================================
# BRANCH SERVICE AREAS (coverage zones)
# ============================================================
def _service_area_out(area: BranchServiceArea) -> dict:
    return {
        "id": str(area.id),
        "branch_id": str(area.branch_id),
        "zone_name": area.zone_name,
        "postal_codes": area.postal_codes,
        "radius_km": area.radius_km,
        "same_day": area.same_day,
        "express": area.express,
    }


@router.get("/service-areas")
def list_service_areas(
    branch_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    bid = _resolve_branch_id(current_user, branch_id)
    areas = db.query(BranchServiceArea).filter(BranchServiceArea.branch_id == bid).order_by(BranchServiceArea.zone_name).all()
    return [_service_area_out(a) for a in areas]


class ServiceAreaIn(BaseModel):
    zone_name: str
    postal_codes: Optional[str] = None
    radius_km: Optional[float] = None
    same_day: bool = False
    express: bool = False


@router.post("/service-areas", status_code=201)
def create_service_area(
    payload: ServiceAreaIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin", "super_admin")),
):
    bid = _resolve_branch_id(current_user, None)
    area = BranchServiceArea(branch_id=bid, **payload.model_dump())
    db.add(area)
    db.commit()
    db.refresh(area)
    return _service_area_out(area)


@router.patch("/service-areas/{area_id}")
def update_service_area(
    area_id: str,
    payload: ServiceAreaIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin", "super_admin")),
):
    bid = _resolve_branch_id(current_user, None)
    area = db.query(BranchServiceArea).filter(BranchServiceArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Service area not found")
    if str(area.branch_id) != bid:
        raise HTTPException(status_code=403, detail="This service area does not belong to your branch")

    for key, value in payload.model_dump().items():
        setattr(area, key, value)
    db.commit()
    db.refresh(area)
    return _service_area_out(area)


@router.delete("/service-areas/{area_id}", status_code=204)
def delete_service_area(
    area_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin", "super_admin")),
):
    bid = _resolve_branch_id(current_user, None)
    area = db.query(BranchServiceArea).filter(BranchServiceArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Service area not found")
    if str(area.branch_id) != bid:
        raise HTTPException(status_code=403, detail="This service area does not belong to your branch")

    db.delete(area)
    db.commit()


# ============================================================
# LAST-MILE RIDER ASSIGNMENT (destination hub -> rider)
# ============================================================
def _last_mile_order_out(order: Order) -> dict:
    summary = _order_summary(order)
    summary["rider_id"] = str(order.rider_id) if order.rider_id else None
    summary["rider_name"] = order.rider.user.full_name if order.rider and order.rider.user else None
    summary["rider_accepted"] = order.rider_accepted
    return summary


@router.get("/last-mile-queue")
def last_mile_queue(
    branch_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    """Parcels that have arrived at this destination hub and need a rider
    for the final leg - unassigned (manual mode) or already offered and
    awaiting the rider's response."""
    bid = _resolve_branch_id(current_user, branch_id)
    orders = (
        db.query(Order)
        .options(joinedload(Order.dropoff_address), joinedload(Order.rider).joinedload(RiderProfile.user))
        .filter(Order.branch_id == bid, Order.status == OrderStatus.dest_hub)
        .order_by(Order.updated_at.asc())
        .all()
    )
    return [_last_mile_order_out(o) for o in orders]


@router.get("/riders")
def list_hub_riders(
    branch_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    """Active riders based at this branch - populates the manual assign-rider dropdown."""
    bid = _resolve_branch_id(current_user, branch_id)
    riders = (
        db.query(RiderProfile)
        .options(joinedload(RiderProfile.user))
        .filter(RiderProfile.branch_id == bid, RiderProfile.status == RiderStatus.active)
        .order_by(RiderProfile.rating.desc())
        .all()
    )
    return [
        {
            "rider_id": str(r.id),
            "full_name": r.user.full_name if r.user else "Unknown",
            "phone": r.user.phone if r.user else None,
            "vehicle_type": r.vehicle_type,
            "is_available": r.is_available or False,
            "rating": r.rating,
            "cod_wallet_locked": r.cod_wallet_locked or False,
        }
        for r in riders
    ]


@router.patch("/orders/{order_id}/assign-rider/{rider_id}")
def hub_assign_last_mile_rider(
    order_id: str,
    rider_id: str,
    branch_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    """Manually offers a specific rider the last-mile leg of a parcel that's
    arrived at this hub. Available regardless of the branch's automatic/
    manual setting - automatic just means hub staff don't have to do this."""
    bid = _resolve_branch_id(current_user, branch_id)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if str(order.branch_id) != bid:
        raise HTTPException(status_code=403, detail="This parcel does not belong to your branch")
    if order.status != OrderStatus.dest_hub:
        raise HTTPException(status_code=400, detail="Only parcels that have arrived at this hub can be assigned a last-mile rider")

    rider = (
        db.query(RiderProfile)
        .options(joinedload(RiderProfile.user))
        .filter(RiderProfile.id == rider_id, RiderProfile.status == RiderStatus.active, RiderProfile.branch_id == bid)
        .first()
    )
    if not rider:
        raise HTTPException(status_code=404, detail="Active rider not found at this branch")
    if rider.cod_wallet_locked and order.payment and order.payment.method.value == "cash":
        raise HTTPException(status_code=400, detail="This rider's COD wallet is locked and cannot accept new COD parcels")

    offer_last_mile_rider(
        db,
        order,
        rider,
        actor=current_user,
        note=f"Manually assigned by {current_user.full_name} at branch {bid}",
    )
    db.commit()
    db.refresh(order)
    return _last_mile_order_out(order)


# ============================================================
# HUB SETTINGS (manual / automatic last-mile assignment)
# ============================================================
class HubSettingsIn(BaseModel):
    rider_assignment_mode: Literal["manual", "automatic"]


def _hub_settings_out(branch: Branch) -> dict:
    return {"branch_id": str(branch.id), "rider_assignment_mode": branch.rider_assignment_mode}


@router.get("/settings")
def get_hub_settings(
    branch_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*HUB_ROLES)),
):
    bid = _resolve_branch_id(current_user, branch_id)
    branch = db.query(Branch).filter(Branch.id == bid).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return _hub_settings_out(branch)


@router.patch("/settings")
def update_hub_settings(
    payload: HubSettingsIn,
    db: Session = Depends(get_db),
    # Toggling how the hub assigns riders is a branch-operating-policy call,
    # not a routine staff action.
    current_user: User = Depends(require_roles("manager", "admin", "super_admin")),
):
    bid = _resolve_branch_id(current_user, None)
    branch = db.query(Branch).filter(Branch.id == bid).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    branch.rider_assignment_mode = payload.rider_assignment_mode
    db.commit()
    db.refresh(branch)
    return _hub_settings_out(branch)
