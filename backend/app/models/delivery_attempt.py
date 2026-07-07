from sqlalchemy import Column, Integer, String, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class DeliveryAttempt(Base, TimestampMixin):
    __tablename__ = "delivery_attempts"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    order_id = Column(UUID_TYPE, ForeignKey("orders.id"), nullable=False)
    order = relationship("Order", back_populates="delivery_attempts")
    attempt_number = Column(Integer, nullable=False)  # e.g., 1 for first attempt, 2 for second attempt
    status = Column(String(50), nullable=False)  # e.g., "successful", "failed", "rescheduled"
    notes = Column(String(255), nullable=True)  # Optional notes about the delivery attempt