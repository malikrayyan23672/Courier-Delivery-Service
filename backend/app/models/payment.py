import enum
from sqlalchemy import Column, String, Float, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class PaymentMethod(str, enum.Enum):
    cash = "cash"                # collected by staff at office
    card = "card"
    online_gateway = "online_gateway"
    wallet = "wallet"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    order_id = Column(UUID_TYPE, ForeignKey("orders.id"), unique=True, nullable=False)

    amount = Column(Float, nullable=False)
    method = Column(Enum(PaymentMethod), nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)

    # For idempotency on gateway retries / webhook replays
    idempotency_key = Column(String(255), unique=True, nullable=True)
    gateway_reference = Column(String(255), nullable=True)

    # If cash was collected by staff, track who collected it
    collected_by_staff_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)

    order = relationship("Order", back_populates="payment")
