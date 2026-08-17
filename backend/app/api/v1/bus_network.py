import random
import string
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.bus_network import (
    BusOperator,
    BusSchedule,
    BusManifest,
    ManifestItem,
    ManifestStatus,
    ScanStatus,
)
from app.models.order import Order, OrderStatus
from app.services.order_service import transition
from app.services import log_service
from app.schemas.bus_network import (
    BusOperatorIn,
    BusOperatorOut,
    BusOperatorStatusIn,
    BusScheduleIn,
    BusScheduleOut,
    BusManifestIn,
    BusManifestOut,
    ManifestItemOut,
    ManifestStatusIn,
)

router = APIRouter(prefix="/admin/bus", tags=["Admin - Bus Network"])


def gen_manifest_number() -> str:
    return "MF-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ---- Operators (Layer 1) ----


@router.get("/operators", response_model=list[BusOperatorOut])
def list_operators(
    db: Session = Depends(get_db),
    # Read access for the branch console (schedule/operator pickers) too -
    # writing operators stays admin-only.
    current_user: User = Depends(require_roles("admin", "super_admin", "staff", "manager")),
):
    return [BusOperatorOut.model_validate(o) for o in db.query(BusOperator).order_by(BusOperator.name).all()]


@router.post("/operators", response_model=BusOperatorOut, status_code=201)
def create_operator(
    payload: BusOperatorIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    operator = BusOperator(**payload.model_dump())
    db.add(operator)
    db.commit()
    db.refresh(operator)
    return BusOperatorOut.model_validate(operator)


@router.patch("/operators/{operator_id}", response_model=BusOperatorOut)
def update_operator_status(
    operator_id: str,
    payload: BusOperatorStatusIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Deactivate (remove) a bus operator. Schedules keep referencing the row,
    so this is a soft-remove - the operator stops appearing in active options
    while historical manifests still resolve their operator name."""
    operator = db.query(BusOperator).filter(BusOperator.id == operator_id).first()
    if not operator:
        raise HTTPException(status_code=404, detail="Bus operator not found")
    operator.status = payload.status
    db.commit()
    db.refresh(operator)
    return BusOperatorOut.model_validate(operator)


# ---- Schedules ----


def _schedule_out(s: BusSchedule) -> BusScheduleOut:
    return BusScheduleOut(
        id=str(s.id),
        operator_id=str(s.operator_id),
        operator_name=s.operator.name if s.operator else None,
        origin_city=s.origin_city,
        destination_city=s.destination_city,
        origin_branch_id=str(s.origin_branch_id) if s.origin_branch_id else None,
        destination_branch_id=str(s.destination_branch_id) if s.destination_branch_id else None,
        departure_time=s.departure_time,
        departure_interval_min=s.departure_interval_min,
        fare=s.fare,
        status=s.status,
    )


@router.get("/schedules", response_model=list[BusScheduleOut])
def list_schedules(
    db: Session = Depends(get_db),
    # Branch console needs the schedule picker when creating a manifest.
    current_user: User = Depends(require_roles("admin", "super_admin", "staff", "manager")),
):
    return [
        _schedule_out(s)
        for s in db.query(BusSchedule).options(joinedload(BusSchedule.operator)).order_by(BusSchedule.origin_city).all()
    ]


@router.post("/schedules", response_model=BusScheduleOut, status_code=201)
def create_schedule(
    payload: BusScheduleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    operator = db.query(BusOperator).filter(BusOperator.id == payload.operator_id).first()
    if not operator:
        raise HTTPException(status_code=404, detail="Bus operator not found")

    schedule = BusSchedule(**payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return _schedule_out(schedule)


# ---- Manifests (crate tracking) ----


def _manifest_out(m: BusManifest) -> BusManifestOut:
    return BusManifestOut(
        id=str(m.id),
        manifest_number=m.manifest_number,
        coach_number=m.coach_number,
        departure_at=m.departure_at,
        origin_city=m.origin_city,
        destination_city=m.destination_city,
        status=m.status.value if hasattr(m.status, "value") else m.status,
        operator_name=m.schedule.operator.name if m.schedule and m.schedule.operator else None,
        items=[
            ManifestItemOut(
                id=str(i.id),
                order_id=str(i.order_id) if i.order_id else None,
                crate_label=i.crate_label,
                scan_status=i.scan_status.value if hasattr(i.scan_status, "value") else i.scan_status,
                scanned_at=i.scanned_at,
                tracking_number=i.order.tracking_number if i.order else None,
            )
            for i in m.items
        ],
    )


@router.get("/manifests", response_model=list[BusManifestOut])
def list_manifests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "staff", "manager")),
):
    rows = (
        db.query(BusManifest)
        .options(
            joinedload(BusManifest.schedule).joinedload(BusSchedule.operator),
            joinedload(BusManifest.items).joinedload(ManifestItem.order),
        )
        .order_by(BusManifest.created_at.desc())
        .all()
    )
    return [_manifest_out(m) for m in rows]


@router.post("/manifests", response_model=BusManifestOut, status_code=201)
def create_manifest(
    payload: BusManifestIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "staff", "manager")),
):
    manifest = BusManifest(
        **payload.model_dump(exclude_none=True),
        manifest_number=payload.manifest_number or gen_manifest_number(),
    )
    db.add(manifest)
    db.flush()
    db.commit()
    db.refresh(manifest)
    return _manifest_out(manifest)


@router.post("/manifests/{manifest_id}/items", response_model=BusManifestOut, status_code=201)
def add_manifest_item(
    manifest_id: str,
    order_id: str | None = None,
    crate_label: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "staff", "manager")),
):
    manifest = db.query(BusManifest).filter(BusManifest.id == manifest_id).first()
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")
    if manifest.status != ManifestStatus.in_preparation:
        # Manifest lock: no writes once the bus has departed (TRD: 403 on any
        # write to a locked manifest).
        raise HTTPException(status_code=403, detail="This manifest has already departed and is locked")

    order = None
    if order_id:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        # A manifest carries either forward-moving hub freight (`in_hub`) or a
        # return/RTO batch heading back to the seller (`rto`) - both are
        # "ready to load at this hub" states. Anything else means the parcel
        # hasn't been scanned in yet, or has already moved on.
        if order.status not in (OrderStatus.in_hub, OrderStatus.rto):
            raise HTTPException(
                status_code=400,
                detail=f"Order must be scanned in at the hub (in_hub) or awaiting return (rto) before it can be loaded onto a manifest - currently '{order.status.value if hasattr(order.status, 'value') else order.status}'",
            )

    db.add(
        ManifestItem(
            manifest_id=manifest.id,
            order_id=order_id,
            crate_label=crate_label or (order.tracking_number if order else None),
            scan_status=ScanStatus.loaded,
        )
    )
    db.commit()
    manifest = (
        db.query(BusManifest)
        .options(joinedload(BusManifest.items).joinedload(ManifestItem.order))
        .filter(BusManifest.id == manifest_id)
        .first()
    )
    return _manifest_out(manifest)


@router.patch("/manifests/{manifest_id}/status", response_model=BusManifestOut)
def update_manifest_status(
    manifest_id: str,
    payload: ManifestStatusIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "staff", "manager")),
):
    """
    Advancing a manifest's status also advances every linked order's status
    (hub scans and order state were previously disconnected). Departure
    (`in_transit`) also locks the manifest against further item writes.
    On arrival, pass `scanned_item_ids` to record which crates were actually
    scanned off the bus - anything on the manifest but not in that list is
    logged as a manifest count mismatch (TRD: "discrepancy triggers INCIDENT")
    and held back at `in_transit` rather than silently marked arrived.
    """
    manifest = (
        db.query(BusManifest)
        .options(joinedload(BusManifest.items).joinedload(ManifestItem.order))
        .filter(BusManifest.id == manifest_id)
        .first()
    )
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")

    new_manifest_status = ManifestStatus(payload.status)
    items_to_advance = manifest.items

    if new_manifest_status == ManifestStatus.arrived and payload.scanned_item_ids is not None:
        scanned_ids = set(payload.scanned_item_ids)
        missing = [i for i in manifest.items if str(i.id) not in scanned_ids]
        items_to_advance = [i for i in manifest.items if str(i.id) in scanned_ids]
        if missing:
            log_service.create_log(
                db,
                action="manifest_count_mismatch",
                user_id=str(current_user.id),
                entity_type="BusManifest",
                entity_id=str(manifest.id),
                details=f"Expected {len(manifest.items)} crates, scanned {len(items_to_advance)}. Missing: "
                        + ", ".join(i.crate_label or str(i.id) for i in missing),
            )

    manifest.status = new_manifest_status

    item_status = ScanStatus(payload.item_status) if payload.item_status else None
    for item in items_to_advance:
        if item_status:
            item.scan(item_status)
        if item.order:
            if new_manifest_status == ManifestStatus.in_transit and item.order.status == OrderStatus.in_hub:
                transition(db, item.order, OrderStatus.in_transit, actor=current_user, note=f"Manifest {manifest.manifest_number} departed")
            elif new_manifest_status == ManifestStatus.arrived and item.order.status == OrderStatus.in_transit:
                transition(db, item.order, OrderStatus.dest_hub, actor=current_user, note=f"Manifest {manifest.manifest_number} arrived")

    db.commit()
    manifest = (
        db.query(BusManifest)
        .options(joinedload(BusManifest.items).joinedload(ManifestItem.order))
        .filter(BusManifest.id == manifest_id)
        .first()
    )
    return _manifest_out(manifest)


# ---- Public manifest tracking (no auth - like the public order tracking) ----

public_router = APIRouter(prefix="/bus", tags=["Bus Network"])


@public_router.get("/manifests/{manifest_id}", response_model=BusManifestOut)
def get_manifest_public(
    manifest_id: str,
    db: Session = Depends(get_db),
):
    # Accept either a UUID or the human-readable manifest number.
    try:
        uuid.UUID(manifest_id)
        filter_by = BusManifest.id == manifest_id
    except ValueError:
        filter_by = BusManifest.manifest_number == manifest_id
    manifest = (
        db.query(BusManifest)
        .options(
            joinedload(BusManifest.schedule).joinedload(BusSchedule.operator),
            joinedload(BusManifest.items).joinedload(ManifestItem.order),
        )
        .filter(filter_by)
        .first()
    )
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")
    return _manifest_out(manifest)