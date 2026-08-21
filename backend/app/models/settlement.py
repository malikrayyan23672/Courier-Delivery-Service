import enum
from datetime import datetime, timedelta, timezone

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class SettlementStatus(str, enum.Enum):
    pending = "pending"       # COD collected, payout scheduled for T+1
    paid = "paid"             # settled by admin on/after the due morning
    cancelled = "cancelled"


class Settlement(Base, TimestampMixin):
    """
    COD (cash-on-delivery) payout record. A row is created when a COD order is
    marked delivered. The payout is guaranteed on the next morning (T+1), so we
    store the exact morning it becomes due (`settle_due_on`). The admin settles
    everything that is past due - a single manual action each morning.

    `settle_due_on` is always *today at 00:00 UTC* for deliveries that already
    happened before today, so "T+1, next morning guaranteed" is enforced by the
    data model itself.
    """
    __tablename__ = "settlements"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)

    order_id = Column(UUID_TYPE, ForeignKey("orders.id", ondelete='CASCADE'), unique=True, nullable=False)
    payment_id = Column(UUID_TYPE, ForeignKey("payments.id"), nullable=True)

    # The seller/business that receives this payout (null for retail customers).
    business_id = Column(UUID_TYPE, ForeignKey("businesses.id"), nullable=True)
    business = relationship("Business", back_populates="settlements")

    amount = Column(Float, nullable=False)

    settle_due_on = Column(DateTime(timezone=True), nullable=False)

    status = Column(Enum(SettlementStatus), default=SettlementStatus.pending, index=True)
    settled_at = Column(DateTime(timezone=True), nullable=True)
    settled_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    settled_by = relationship("User", foreign_keys=[settled_by_id])
    remark = Column(String(255), nullable=True)

    # Payout method chosen per settlement (bank_transfer / wallet / cheque / cash)
    # and an uploaded receipt proving the money left. Both are recorded by the
    # finance role when a payout is marked paid - the audit log entry carries them.
    payout_method = Column(String(50), nullable=True)
    receipt_url = Column(String(300), nullable=True)

    order = relationship("Order", back_populates="settlement")
    payment = relationship("Payment", back_populates="settlement")

    @classmethod
    def next_morning(cls, delivered_at: datetime) -> datetime:
        """The morning (00:00 UTC) after the delivery day - i.e. T+1."""
        start_of_today = delivered_at.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_of_today + timedelta(days=1)

    @classmethod
    def due_now(cls, now: datetime | None = None) -> datetime:
        """Cutoff used by the manual settle endpoint: everything due on/before today."""
        now = now or datetime.now(timezone.utc)
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
