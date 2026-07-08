from sqlalchemy import Column, String, Float, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class TrackingEvent(Base, TimestampMixin):
    """
    Append-only log of status changes for an order.
    Never update or delete rows here - always insert a new event.

    Note: this table absorbs what would otherwise be a separate
    OrderStatusHistory table - same shape (order_id + status + note +
    timestamp), plus changed_by_id for internal accountability. Keeping
    one table instead of two avoids two write paths for the same event.
    """
    __tablename__ = "tracking_events"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    order_id = Column(UUID_TYPE, ForeignKey("orders.id"), nullable=False, index=True)

    status = Column(String(50), nullable=False)
    note = Column(String(255), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    # Who triggered this change - a rider updating their own delivery, an
    # admin reassigning, a staff member, or None for system-generated events
    changed_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    changed_by = relationship("User", foreign_keys=[changed_by_id])

    order = relationship("Order", back_populates="tracking_events")
