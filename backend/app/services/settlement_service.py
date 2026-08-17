from datetime import datetime, timedelta, timezone

from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from app.models.order import Order, OrderStatus
from app.models.payment import PaymentMethod
from app.models.settlement import Settlement, SettlementStatus
from app.models.wallet import WalletTransaction, WalletTransactionType
from app.models.user import User
from app.models.business import Business
from app.models.dispute import Dispute, DisputeStatus
from app.services import log_service

# Rider cash-in-hand COD wallet (TRD Layer 4). A rider can't accept new COD
# once their held cash reaches the lock threshold - only a finance "unlock"
# (cash deposited at hub) clears it.
WALLET_LOCK_THRESHOLD = 30000.0
WALLET_WARNING_THRESHOLD = 25000.0


def create_cod_settlement(db: Session, order: Order, delivered_by: User | None = None) -> Settlement | None:
    """
    Called when a COD order is marked delivered. Records the payout that is
    guaranteed on the next morning (T+1). The payout target is the customer's
    business account (seller) when the customer is a seller - otherwise the
    retail customer (business_id stays None and the payout is handled manually).
    Also credits the delivering rider's cash-in-hand wallet and auto-locks it
    at WALLET_LOCK_THRESHOLD.
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

    if order.rider:
        order.rider.cod_cash_held = (order.rider.cod_cash_held or 0.0) + amount
        if order.rider.cod_cash_held >= WALLET_LOCK_THRESHOLD:
            order.rider.cod_wallet_locked = True

    db.flush()
    return settlement


def unlock_rider_wallet(db: Session, rider, unlocked_by: User, note: str) -> None:
    """Hub has collected the rider's cash-in-hand - clears the COD wallet lock. Always audited."""
    previous_amount = rider.cod_cash_held or 0.0
    rider.cod_cash_held = 0.0
    rider.cod_wallet_locked = False
    log_service.create_log(
        db,
        action="rider_wallet_unlocked",
        user_id=str(unlocked_by.id),
        entity_type="RiderProfile",
        entity_id=str(rider.id),
        details=f"Cleared PKR {previous_amount:.2f} cash-in-hand. Note: {note}",
    )


def settle_due_settlements(
    db: Session,
    settled_by: User,
    remark: str | None = None,
    payout_method: str | None = None,
) -> tuple[list[Settlement], list[Settlement]]:
    """
    Manual T+1 settle: pays out every pending COD settlement that became due
    on or before today (i.e. COD collected yesterday or earlier). Crediting the
    seller wallet is skipped while the wallet is auto-locked (COD leakage/fraud
    protection), or while the order has an open dispute (financial hold) -
    the settlement stays pending instead. Every payout/hold action is audited
    (TRD: "every payout action writes audit_log, no exceptions").
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

    disputed_order_ids = {
        d.order_id
        for d in db.query(Dispute.order_id).filter(Dispute.status == DisputeStatus.open).all()
    }

    paid: list[Settlement] = []
    blocked: list[Settlement] = []

    for settlement in due:
        if settlement.business and settlement.business.wallet_locked:
            # Wallet auto-locked - hold the payout until reconciliation clears it.
            blocked.append(settlement)
            log_service.create_log(
                db, action="settlement_blocked_wallet_locked", user_id=str(settled_by.id),
                entity_type="Settlement", entity_id=str(settlement.id),
            )
            continue

        if settlement.order_id in disputed_order_ids:
            blocked.append(settlement)
            log_service.create_log(
                db, action="settlement_blocked_dispute", user_id=str(settled_by.id),
                entity_type="Settlement", entity_id=str(settlement.id),
            )
            continue

        settlement.status = SettlementStatus.paid
        settlement.settled_at = Settlement.due_now()
        settlement.settled_by_id = settled_by.id
        settlement.remark = remark
        settlement.payout_method = payout_method

        if settlement.business:
            _credit_business_wallet(db, settlement, settled_by)

        paid.append(settlement)
        log_service.create_log(
            db, action="settlement_paid", user_id=str(settled_by.id),
            entity_type="Settlement", entity_id=str(settlement.id),
            details=f"Paid PKR {settlement.amount:.2f}" + (f" - {remark}" if remark else ""),
        )

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


def cod_trend(db: Session, days: int = 14) -> list[dict]:
    """Daily COD collected (settlement created) vs paid out, for the finance analytics chart."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    collected_rows = (
        db.query(sa_func.date(Settlement.created_at), sa_func.sum(Settlement.amount))
        .filter(Settlement.created_at >= since)
        .group_by(sa_func.date(Settlement.created_at))
        .all()
    )
    paid_rows = (
        db.query(sa_func.date(Settlement.settled_at), sa_func.sum(Settlement.amount))
        .filter(Settlement.settled_at >= since, Settlement.status == SettlementStatus.paid)
        .group_by(sa_func.date(Settlement.settled_at))
        .all()
    )
    collected = {str(day): round(amt or 0.0, 2) for day, amt in collected_rows}
    paid = {str(day): round(amt or 0.0, 2) for day, amt in paid_rows}

    days_list = sorted(set(collected) | set(paid))
    return [
        {"date": d, "collected": collected.get(d, 0.0), "paid": paid.get(d, 0.0)}
        for d in days_list
    ]


def sla_compliance(db: Session) -> dict:
    """% of paid settlements that were paid on/before their T+1 due date."""
    paid = db.query(Settlement).filter(Settlement.status == SettlementStatus.paid).all()
    if not paid:
        return {"on_time": 0, "late": 0, "compliance_pct": 100.0}
    on_time = sum(1 for s in paid if s.settled_at and s.settle_due_on and s.settled_at <= s.settle_due_on + timedelta(days=1))
    late = len(paid) - on_time
    return {
        "on_time": on_time,
        "late": late,
        "compliance_pct": round((on_time / len(paid)) * 100, 1),
    }
