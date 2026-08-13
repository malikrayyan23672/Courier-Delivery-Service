from sqlalchemy.orm import Session

from app.models.order import Order, OrderStatus
from app.models.payment import PaymentMethod
from app.models.settlement import Settlement, SettlementStatus
from app.models.wallet import WalletTransaction, WalletTransactionType
from app.models.user import User
from app.models.business import Business


def create_cod_settlement(db: Session, order: Order, delivered_by: User | None = None) -> Settlement | None:
    """
    Called when a COD order is marked delivered. Records the payout that is
    guaranteed on the next morning (T+1). The payout target is the customer's
    business account (seller) when the customer is a seller - otherwise the
    retail customer (business_id stays None and the payout is handled manually).
    """
    if not order.payment or order.payment.method != PaymentMethod.cash:
        return None

    # Idempotent - a COD order can only ever have one settlement.
    existing = db.query(Settlement).filter(Settlement.order_id == order.id).first()
    if existing:
        return existing

    business = None
    if order.customer and order.customer.business_id:
        business = db.query(Business).filter(Business.id == order.customer.business_id).first()

    amount = order.final_price or order.estimated_price or 0.0

    settlement = Settlement(
        order_id=order.id,
        payment_id=order.payment.id,
        business_id=business.id if business else None,
        amount=amount,
        settle_due_on=Settlement.next_morning(order.updated_at),
        status=SettlementStatus.pending,
    )
    db.add(settlement)
    db.flush()
    return settlement


def settle_due_settlements(
    db: Session,
    settled_by: User,
    remark: str | None = None,
) -> tuple[list[Settlement], list[Settlement]]:
    """
    Manual T+1 settle: pays out every pending COD settlement that became due
    on or before today (i.e. COD collected yesterday or earlier). Crediting the
    seller wallet is skipped while the wallet is auto-locked (COD leakage/fraud
    protection) - the settlement stays pending instead.
    """
    cutoff = Settlement.due_now()
    due = (
        db.query(Settlement)
        .filter(
            Settlement.status == SettlementStatus.pending,
            Settlement.settle_due_on <= cutoff,
        )
        .all()
    )

    paid: list[Settlement] = []
    blocked: list[Settlement] = []

    for settlement in due:
        if settlement.business and settlement.business.wallet_locked:
            # Wallet auto-locked - hold the payout until reconciliation clears it.
            blocked.append(settlement)
            continue

        settlement.status = SettlementStatus.paid
        settlement.settled_at = Settlement.due_now()
        settlement.settled_by_id = settled_by.id
        settlement.remark = remark

        if settlement.business:
            _credit_business_wallet(db, settlement, settled_by)

        paid.append(settlement)

    db.commit()
    return paid, blocked


def _credit_business_wallet(db: Session, settlement: Settlement, settled_by: User) -> None:
    business = settlement.business
    business.wallet_balance = (business.wallet_balance or 0) + int(settlement.amount)
    db.add(
        WalletTransaction(
            business_id=business.id,
            amount=settlement.amount,
            balance_after=business.wallet_balance,
            transaction_type=WalletTransactionType.settlement_credit,
            reference=f"settlement:{settlement.id}",
            created_by_id=settled_by.id,
        )
    )


def pending_cod_amount(db: Session) -> float:
    """Total COD amount awaiting payout (for the admin dashboard summary)."""
    rows = (
        db.query(Settlement.amount)
        .filter(Settlement.status == SettlementStatus.pending)
        .all()
    )
    return round(sum(amount for (amount,) in rows), 2)
