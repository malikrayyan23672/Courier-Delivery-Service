from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.order import Order, OrderStatus
from app.models.tracking_event import TrackingEvent
from app.models.bus_network import BusManifest, BusSchedule, ManifestItem, ManifestStatus
from app.services.order_service import transition

router = APIRouter(prefix="/hub", tags=["Hub Operations"])


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
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
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
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
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


@router.get("/dispatch-queue")
def dispatch_queue(
    branch_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
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
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
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
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
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
    return [_order_summary(o) for o in orders]


@router.get("/aging-parcels")
def aging_parcels(
    branch_id: str | None = Query(None),
    hours: float = Query(4.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
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
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
):
    bid = _resolve_branch_id(current_user, branch_id)
    return _vendor_scores(db, bid)


@router.get("/analytics")
def hub_analytics(
    branch_id: str | None = Query(None),
    days: int = Query(14),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
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

    return {
        "daily": [
            {"date": d, "parcels_in": in_counts.get(d, 0), "parcels_out": out_counts.get(d, 0)}
            for d in all_days
        ],
        "vendor_scores": _vendor_scores(db, bid),
    }
