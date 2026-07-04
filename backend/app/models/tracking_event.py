from sqlalchemy import Column, String, Float, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class TrackingEvent(Base, TimestampMixin):
    """
    Append-only log of status changes for an order.
    Never update or delete rows here - always insert a new event.
    """
    __tablename__ = "tracking_events"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    order_id = Column(UUID_TYPE, ForeignKey("orders.id"), nullable=False, index=True)

    status = Column(String(50), nullable=False)
    note = Column(String(255), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    order = relationship("Order", back_populates="tracking_events")
