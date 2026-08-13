import enum
from sqlalchemy import Column, String, Float, Integer, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class WalletTransactionType(str, enum.Enum):
    settlement_credit = "settlement_credit"   # COD payout credited into the wallet
    cod_debit = "cod_debit"                   # COD collected from the wallet (reverse)
    adjustment = "adjustment"                 # manual correction by ops
    fee = "fee"                               # platform/service charge


class WalletTransaction(Base, TimestampMixin):
    """
    Append-only ledger for a business's COD wallet. Every settlement credit
    and adjustment is recorded here so the wallet balance can be reconstructed
    and digitally reconciled at any time.
    """
    __tablename__ = "wallet_transactions"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    business_id = Column(UUID_TYPE, ForeignKey("businesses.id"), nullable=False)
    business = relationship("Business", back_populates="wallet_transactions")

    amount = Column(Float, nullable=False)  # positive = credit, negative = debit
    balance_after = Column(Float, nullable=True)
    transaction_type = Column(Enum(WalletTransactionType), default=WalletTransactionType.settlement_credit)
    reference = Column(String(255), nullable=True)  # e.g. settlement id, order tracking number
    created_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)


class ReconciliationLog(Base, TimestampMixin):
    """
    Digital reconciliation of a business's wallet against expected COD payouts.
    A mismatch (leakage) can trigger the wallet auto-lock (see Business.wallet_locked).
    """
    __tablename__ = "reconciliation_logs"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    business_id = Column(UUID_TYPE, ForeignKey("businesses.id"), nullable=False)
    business = relationship("Business", back_populates="reconciliations")

    expected_amount = Column(Float, default=0.0)
    actual_amount = Column(Float, default=0.0)
    difference = Column(Float, default=0.0)
    status = Column(String(50), default="matched")  # matched / mismatched / in_review
    notes = Column(String(500), nullable=True)
    reconciled_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
