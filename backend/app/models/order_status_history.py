from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class OrderStatusHistory(Base, TimestampMixin):
    __tablename__ = "order_status_history"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    order_id = Column(UUID_TYPE, ForeignKey("orders.id"), nullable=False)
    order = relationship("Order", back_populates="status_history")
    status = Column(String(50), nullable=False)  # e.g., "pending", "shipped", "delivered"
    changed_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    changed_by = relationship("User")
    remark = Column(String(255), nullable=True)  # Optional notes about the status change