from sqlalchemy import Column, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    order_id = Column(UUID_TYPE, ForeignKey("orders.id", ondelete='CASCADE'), nullable=False)
    order = relationship("Order", back_populates="invoice")

    # Deterministic, derived from the order's own unique tracking_number
    # (f"INV-{order.tracking_number}") at creation time - no separate
    # random-generation/uniqueness-check scheme needed.
    invoice_number = Column(String(50), unique=True, index=True, nullable=False)

    subtotal = Column(Float, nullable=False)
    discount_amount = Column(Float, nullable=True)
    tax_amount = Column(Float, nullable=False, default=0.0)  # reserved for later; always 0.0 for now
    total_amount = Column(Float, nullable=False)

    status = Column(String(50), default="unpaid")  # e.g., "unpaid", "paid", "overdue"
    # created_at (from TimestampMixin) doubles as "issued at" - an invoice is
    # issued at creation time in this design, there's no draft state.
