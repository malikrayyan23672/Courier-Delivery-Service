from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.business import Business
from app.models.wallet import WalletTransaction, ReconciliationLog
from app.services import log_service
from app.schemas.wallet import (
    WalletOut,
    WalletLockIn,
    WalletTransactionOut,
    ReconciliationIn,
    ReconciliationOut,
)

router = APIRouter(prefix="/admin/wallets", tags=["Admin - Seller Wallets"])


def _wallet_out(b: Business) -> WalletOut:
    return WalletOut(
        id=str(b.id),
        company_name=b.company_name,
        email=b.email,
        wallet_balance=b.wallet_balance or 0,
        wallet_locked=b.wallet_locked,
        wallet_lock_reason=b.wallet_lock_reason,
        status=b.status,
    )


@router.get("", response_model=list[WalletOut])
def list_wallets(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "finance")),
):
    return [_wallet_out(b) for b in db.query(Business).order_by(Business.created_at.desc()).all()]


@router.patch("/{business_id}/lock", response_model=WalletOut)
def set_wallet_lock(
    business_id: str,
    payload: WalletLockIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "finance")),
):
    """Auto-lock (or unlock) a seller's COD wallet - blocks payouts until reconciled."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    business.wallet_locked = payload.lock
    business.wallet_lock_reason = payload.reason if payload.lock else None
    db.commit()
    log_service.create_log(
        db,
        action="wallet_locked" if payload.lock else "wallet_unlocked",
        user_id=str(current_user.id),
        entity_type="Business",
        entity_id=str(business.id),
        details=payload.reason,
    )
    db.refresh(business)
    return _wallet_out(business)


@router.get("/{business_id}/transactions", response_model=list[WalletTransactionOut])
def wallet_transactions(
    business_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "finance")),
):
    rows = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.business_id == business_id)
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )
    return [WalletTransactionOut.model_validate(t) for t in rows]


@router.post("/{business_id}/reconcile", response_model=ReconciliationOut)
def reconcile_wallet(
    business_id: str,
    payload: ReconciliationIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "finance")),
):
    """
    Digital reconciliation. Expected = what COD payouts say, actual = what the
    wallet shows. A difference (leakage) flags the wallet as mismatched and
    auto-locks it - no payout can happen until the discrepancy is resolved.
    """
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    difference = round(payload.expected_amount - payload.actual_amount, 2)
    status = "matched" if abs(difference) < 0.01 else "mismatched"

    log = ReconciliationLog(
        business_id=business_id,
        expected_amount=payload.expected_amount,
        actual_amount=payload.actual_amount,
        difference=difference,
        status=status,
        notes=payload.notes,
        reconciled_by_id=current_user.id,
    )
    db.add(log)

    # Auto-lock on leakage (COD fraud protection).
    if status == "mismatched":
        business.wallet_locked = True
        business.wallet_lock_reason = f"Reconciliation mismatch of {difference}"

    db.commit()
    log_service.create_log(
        db,
        action="wallet_reconciled" if status == "matched" else "wallet_reconciliation_mismatch",
        user_id=str(current_user.id),
        entity_type="Business",
        entity_id=str(business.id),
        details=f"Expected {payload.expected_amount}, actual {payload.actual_amount}, diff {difference}",
    )
    db.refresh(log)
    return ReconciliationOut.model_validate(log)


@router.get("/{business_id}/reconciliations", response_model=list[ReconciliationOut])
def list_reconciliations(
    business_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "finance")),
):
    rows = (
        db.query(ReconciliationLog)
        .filter(ReconciliationLog.business_id == business_id)
        .order_by(ReconciliationLog.created_at.desc())
        .all()
    )
    return [ReconciliationOut.model_validate(r) for r in rows]