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
from app.models.order import Order
from app.schemas.bus_network import (
    BusOperatorIn,
    BusOperatorOut,
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
    current_user: User = Depends(require_roles("admin", "super_admin")),
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
    current_user: User = Depends(require_roles("admin", "super_admin")),
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
    current_user: User = Depends(require_roles("admin", "super_admin")),
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
    current_user: User = Depends(require_roles("admin", "super_admin")),
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
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    manifest = db.query(BusManifest).filter(BusManifest.id == manifest_id).first()
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")

    if order_id:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

    db.add(
        ManifestItem(
            manifest_id=manifest.id,
            order_id=order_id,
            crate_label=crate_label or (order.tracking_number if order_id else None),
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
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    manifest = db.query(BusManifest).filter(BusManifest.id == manifest_id).first()
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")

    manifest.status = ManifestStatus(payload.status)

    # One scan advances the whole busload (crate tracking).
    if payload.item_status:
        item_status = ScanStatus(payload.item_status)
        for item in manifest.items:
            item.scan(item_status)

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