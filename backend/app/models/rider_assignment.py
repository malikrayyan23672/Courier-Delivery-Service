from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class RiderAssignment(Base, TimestampMixin):
    __tablename__ = "rider_assignments"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    rider_id = Column(UUID_TYPE, ForeignKey("riders.id"), nullable=False)
    rider = relationship("RiderProfile", back_populates="rider_assignments")
    order_id = Column(UUID_TYPE, ForeignKey("orders.id"), nullable=False)
    order = relationship("Order", back_populates="rider_assignments")
    status = Column(String(50), default="assigned")  # e.g., "assigned", "in_progress", "completed"
