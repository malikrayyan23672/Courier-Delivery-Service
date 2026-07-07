from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class LiveTracking(Base, TimestampMixin):
    __tablename__ = "live_tracking"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    order_id = Column(UUID_TYPE, ForeignKey("orders.id"), nullable=False)
    order = relationship("Order", back_populates="live_tracking")
    latitude = Column(String(50), nullable=True)
    longitude = Column(String(50), nullable=True)
    speed_kmh = Column(Integer, nullable=True)  # Speed in kilometers per hour
    status = Column(String(50), default="in_transit")  # e.g., "in_transit", "delivered"