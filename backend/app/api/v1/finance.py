from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.business import Business
from app.models.rider import RiderProfile
from app.models.order import Order
from app.models.zone import Zone
from app.models.settlement import Settlement, SettlementStatus
from app.models.dispute import Dispute, DisputeStatus
from app.schemas.dispute import DisputeOut, DisputeCreateIn, DisputeResolveIn
from app.schemas.finance import RiderWalletOut, RiderWalletUnlockIn, FinanceDashboardOut
from app.services import log_service
from app.utils.uploads import save_dispute_evidence
from app.services.settlement_service import (
    pending_cod_amount,
    cod_trend,
    sla_compliance,
    unlock_rider_wallet,
    rider_wallet_limit,
    rider_wallet_warning_at,
)

router = APIRouter(prefix="/finance", tags=["Finance & COD Engine"])

FINANCE_ROLES = ("finance", "admin", "super_admin")


# ---- Dashboard ----


@router.get("/dashboard", response_model=FinanceDashboardOut)
def finance_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FINANCE_ROLES)),
):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    cod_collected_total = db.query(func.sum(Settlement.amount)).scalar() or 0.0
    cod_paid_today = (
        db.query(func.sum(Settlement.amount))
        .filter(Settlement.status == SettlementStatus.paid, Settlement.settled_at >= today_start)
        .scalar()
        or 0.0
    )
    open_disputes = db.query(Dispute).filter(Dispute.status == DisputeStatus.open).count()
    wallet_locked_riders = db.query(RiderProfile).filter(RiderProfile.cod_wallet_locked.is_(True)).count()
    wallet_locked_businesses = db.query(Business).filter(Business.wallet_locked.is_(True)).count()

    return FinanceDashboardOut(
        cod_collected_total=round(cod_collected_total, 2),
        cod_pending_payout=pending_cod_amount(db),
        cod_paid_today=round(cod_paid_today, 2),
        open_disputes=open_disputes,
        wallet_locked_riders=wallet_locked_riders,
        wallet_locked_businesses=wallet_locked_businesses,
        sla_compliance_pct=sla_compliance(db)["compliance_pct"],
    )


@router.get("/analytics")
def finance_analytics(
    days: int = 14,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FINANCE_ROLES)),
):
    return {
        "cod_trend": cod_trend(db, days=days),
        "sla": sla_compliance(db),
    }


# ---- Reconciliation ----


@router.get("/reconciliation")
def reconciliation(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FINANCE_ROLES)),
):
    """Per-seller and per-zone (corridor) breakdown of pending vs paid COD."""
    by_business_rows = (
        db.query(
            Business.id,
            Business.company_name,
            Settlement.status,
            func.sum(Settlement.amount),
            func.count(Settlement.id),
        )
        .join(Settlement, Settlement.business_id == Business.id)
        .group_by(Business.id, Business.company_name, Settlement.status)
        .all()
    )
    by_business: dict[str, dict] = {}
    for biz_id, company_name, status, amount, count in by_business_rows:
        entry = by_business.setdefault(str(biz_id), {"business_id": str(biz_id), "company_name": company_name, "pending": 0.0, "paid": 0.0, "pending_count": 0, "paid_count": 0})
        status_val = status.value if hasattr(status, "value") else status
        if status_val == "pending":
            entry["pending"] = round(amount or 0.0, 2)
            entry["pending_count"] = count
        elif status_val == "paid":
            entry["paid"] = round(amount or 0.0, 2)
            entry["paid_count"] = count

    by_zone_rows = (
        db.query(
            Zone.id,
            Zone.name,
            Settlement.status,
            func.sum(Settlement.amount),
        )
        .join(Order, Settlement.order_id == Order.id)
        .join(Zone, Order.zone_id == Zone.id)
        .group_by(Zone.id, Zone.name, Settlement.status)
        .all()
    )
    by_zone: dict[str, dict] = {}
    for zone_id, zone_name, status, amount in by_zone_rows:
        entry = by_zone.setdefault(str(zone_id), {"zone_id": str(zone_id), "zone_name": zone_name, "pending": 0.0, "paid": 0.0})
        status_val = status.value if hasattr(status, "value") else status
        if status_val == "pending":
            entry["pending"] = round(amount or 0.0, 2)
        elif status_val == "paid":
            entry["paid"] = round(amount or 0.0, 2)

    return {
        "by_business": list(by_business.values()),
        "by_corridor": list(by_zone.values()),
    }


# ---- Disputes ----


def _dispute_out(d: Dispute) -> DisputeOut:
    return DisputeOut(
        id=str(d.id),
        order_id=str(d.order_id),
        tracking_number=d.order.tracking_number if d.order else None,
        business_id=str(d.business_id) if d.business_id else None,
        company_name=d.business.company_name if d.business else None,
        raised_by_id=str(d.raised_by_id),
        reason=d.reason,
        status=d.status.value if hasattr(d.status, "value") else d.status,
        evidence_urls=list(d.evidence_urls or []),
        resolution_note=d.resolution_note,
        resolved_at=d.resolved_at,
        created_at=d.created_at,
    )


@router.get("/disputes", response_model=list[DisputeOut])
def list_disputes(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FINANCE_ROLES)),
):
    q = db.query(Dispute).options(joinedload(Dispute.order), joinedload(Dispute.business)).order_by(Dispute.created_at.desc())
    if status_filter:
        q = q.filter(Dispute.status == status_filter)
    return [_dispute_out(d) for d in q.all()]


@router.post("/disputes", response_model=DisputeOut, status_code=201)
def create_dispute(
    payload: DisputeCreateIn,
    db: Session = Depends(get_db),
    # A seller can raise a dispute on their own COD, finance/admin can log one on a seller's behalf.
    current_user: User = Depends(require_roles("business", *FINANCE_ROLES)),
):
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    business_id = None
    if current_user.business_id:
        business_id = current_user.business_id
    elif order.customer and order.customer.business_id:
        business_id = order.customer.business_id

    dispute = Dispute(
        order_id=order.id,
        business_id=business_id,
        raised_by_id=current_user.id,
        reason=payload.reason,
    )
    db.add(dispute)
    db.commit()
    log_service.create_log(
        db, action="dispute_raised", user_id=str(current_user.id),
        entity_type="Order", entity_id=str(order.id), details=payload.reason,
    )
    db.refresh(dispute)
    return _dispute_out(dispute)


@router.patch("/disputes/{dispute_id}/resolve", response_model=DisputeOut)
def resolve_dispute(
    dispute_id: str,
    payload: DisputeResolveIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FINANCE_ROLES)),
):
    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if dispute.status != DisputeStatus.open:
        raise HTTPException(status_code=400, detail="This dispute has already been resolved")

    dispute.resolve(resolved_by_id=current_user.id, note=payload.note, accepted=payload.accepted)
    db.commit()
    # Financial hold clearing is itself a payout-adjacent action - always audited.
    log_service.create_log(
        db,
        action="dispute_resolved" if payload.accepted else "dispute_rejected",
        user_id=str(current_user.id),
        entity_type="Dispute",
        entity_id=str(dispute.id),
        details=payload.note,
    )
    db.refresh(dispute)
    return _dispute_out(dispute)


@router.post("/disputes/{dispute_id}/evidence", response_model=DisputeOut)
def add_dispute_evidence(
    dispute_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FINANCE_ROLES)),
):
    """Attach an evidence photo (receipt, parcel photo, delivery capture) to a dispute under review."""
    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if dispute.status != DisputeStatus.open:
        raise HTTPException(status_code=400, detail="Evidence can only be added to an open dispute")

    evidence_url = save_dispute_evidence(str(dispute.id), file)
    dispute.evidence_urls = list(dispute.evidence_urls or []) + [evidence_url]
    db.commit()
    log_service.create_log(
        db, action="dispute_evidence_added", user_id=str(current_user.id),
        entity_type="Dispute", entity_id=str(dispute.id), details=evidence_url,
    )
    db.refresh(dispute)
    return _dispute_out(dispute)


# ---- Rider COD wallets ----


@router.get("/rider-wallets", response_model=list[RiderWalletOut])
def list_rider_wallets(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FINANCE_ROLES)),
):
    riders = db.query(RiderProfile).options(joinedload(RiderProfile.user)).order_by(RiderProfile.cod_cash_held.desc()).all()
    return [
        RiderWalletOut(
            rider_id=str(r.id),
            full_name=r.user.full_name if r.user else "Unknown",
            phone=r.user.phone if r.user else None,
            cod_cash_held=r.cod_cash_held or 0.0,
            cod_wallet_locked=r.cod_wallet_locked or False,
            wallet_limit=rider_wallet_limit(r),
            wallet_warning_at=rider_wallet_warning_at(r),
        )
        for r in riders
    ]


@router.post("/rider-wallets/{rider_id}/unlock", response_model=RiderWalletOut)
def unlock_rider_wallet_endpoint(
    rider_id: str,
    payload: RiderWalletUnlockIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*FINANCE_ROLES)),
):
    rider = db.query(RiderProfile).options(joinedload(RiderProfile.user)).filter(RiderProfile.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    if not rider.cod_wallet_locked and not rider.cod_cash_held:
        raise HTTPException(status_code=400, detail="This rider's wallet isn't locked or holding any cash")

    unlock_rider_wallet(db, rider, unlocked_by=current_user, note=payload.note)
    db.commit()
    db.refresh(rider)
    return RiderWalletOut(
        rider_id=str(rider.id),
        full_name=rider.user.full_name if rider.user else "Unknown",
        phone=rider.user.phone if rider.user else None,
        cod_cash_held=rider.cod_cash_held or 0.0,
        cod_wallet_locked=rider.cod_wallet_locked or False,
        wallet_limit=rider_wallet_limit(rider),
        wallet_warning_at=rider_wallet_warning_at(rider),
    )
