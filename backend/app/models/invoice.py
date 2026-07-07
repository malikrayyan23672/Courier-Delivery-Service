from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    order_id = Column(UUID_TYPE, ForeignKey("orders.id"), nullable=False)
    order = relationship("Order", back_populates="invoice")
    amount = Column(Integer, nullable=False)  # Total amount for the invoice
    status = Column(String(50), default="unpaid")  # e.g., "unpaid", "paid", "overdue"
    issued_at = Column(TimestampMixin.TIMESTAMP_TYPE, nullable=False)  # When the invoice was issued
    due_at = Column(TimestampMixin.TIMESTAMP_TYPE, nullable=False)  # When the payment is due