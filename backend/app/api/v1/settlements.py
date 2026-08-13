from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.settlement import Settlement, SettlementStatus
from app.schemas.settlement import SettlementOut, SettleResultOut
from app.services.settlement_service import settle_due_settlements, pending_cod_amount

router = APIRouter(prefix="/admin/settlements", tags=["Admin - COD Settlements"])


def _to_out(s: Settlement) -> SettlementOut:
    return SettlementOut(
        id=str(s.id),
        order_id=str(s.order_id),
        business_id=str(s.business_id) if s.business_id else None,
        company_name=s.business.company_name if s.business else None,
        tracking_number=s.order.tracking_number if s.order else None,
        amount=s.amount,
        settle_due_on=s.settle_due_on,
        status=s.status.value if hasattr(s.status, "value") else s.status,
        settled_at=s.settled_at,
        remark=s.remark,
        created_at=s.created_at,
    )


@router.get("", response_model=list[SettlementOut])
def list_settlements(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    q = db.query(Settlement).order_by(Settlement.created_at.desc())
    if status_filter:
        q = q.filter(Settlement.status == status_filter)
    return [_to_out(s) for s in q.all()]


@router.get("/summary")
def settlement_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Pending COD exposure - drives the 'Settle T+1' button label."""
    pending = (
        db.query(Settlement)
        .filter(Settlement.status == SettlementStatus.pending)
        .count()
    )
    return {
        "pending_count": pending,
        "pending_amount": pending_cod_amount(db),
    }


@router.post("/settle-t1", response_model=SettleResultOut)
def settle_t1(
    remark: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """
    Manual T+1 settlement. Pays out every pending COD order delivered on or
    before yesterday (settle_due_on <= today). Settlements whose seller wallet
    is auto-locked are held back, not paid.
    """
    paid, blocked = settle_due_settlements(
        db,
        settled_by=current_user,
        remark=remark or "T+1 manual settlement",
    )
    return SettleResultOut(
        settled=[_to_out(s) for s in paid],
        blocked=[_to_out(s) for s in blocked],
    )


@router.post("/{settlement_id}/settle", response_model=SettlementOut)
def settle_one(
    settlement_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    settlement = db.query(Settlement).filter(Settlement.id == settlement_id).first()
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    if settlement.status != SettlementStatus.pending:
        raise HTTPException(status_code=400, detail="Settlement is not pending")

    if settlement.business and settlement.business.wallet_locked:
        raise HTTPException(
            status_code=409,
            detail="Seller wallet is auto-locked - reconcile the wallet before settling.",
        )

    settlement.status = SettlementStatus.paid
    settlement.settled_at = Settlement.due_now()
    settlement.settled_by_id = current_user.id
    settlement.remark = "Settled individually"

    if settlement.business:
        settlement.business.wallet_balance = (settlement.business.wallet_balance or 0) + int(
            settlement.amount
        )
        from app.models.wallet import WalletTransaction, WalletTransactionType
        db.add(
            WalletTransaction(
                business_id=settlement.business.id,
                amount=settlement.amount,
                balance_after=settlement.business.wallet_balance,
                transaction_type=WalletTransactionType.settlement_credit,
                reference=f"settlement:{settlement.id}",
                created_by_id=current_user.id,
            )
        )

    db.commit()
    db.refresh(settlement)
    return _to_out(settlement)