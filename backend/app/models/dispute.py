import enum
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class DisputeStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"
    rejected = "rejected"


class Dispute(Base, TimestampMixin):
    """
    A COD dispute raised against a delivered order (short payment, wrong
    amount collected, non-delivery claim, etc). While `status == open`, the
    linked settlement is held back from payout - see
    settlement_service.settle_due_settlements().
    """
    __tablename__ = "disputes"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)

    order_id = Column(UUID_TYPE, ForeignKey("orders.id"), nullable=False)
    order = relationship("Order")

    business_id = Column(UUID_TYPE, ForeignKey("businesses.id"), nullable=True)
    business = relationship("Business")

    raised_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    reason = Column(String(500), nullable=False)

    status = Column(Enum(DisputeStatus, native_enum=False, length=20), default=DisputeStatus.open, index=True)

    resolution_note = Column(String(500), nullable=True)
    resolved_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    def resolve(self, resolved_by_id: str, note: str | None, accepted: bool) -> None:
        self.status = DisputeStatus.resolved if accepted else DisputeStatus.rejected
        self.resolution_note = note
        self.resolved_by_id = resolved_by_id
        self.resolved_at = datetime.now(timezone.utc)
