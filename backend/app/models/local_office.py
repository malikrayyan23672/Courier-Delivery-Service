from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class LocalOffice(Base, TimestampMixin):
    """
    A guest-facing walk-in booking counter under a Hub. Where a guest's
    parcel is booked (order.local_office_id) - distinct from the Hub itself,
    which is a sorting/scan facility, not a counter. Reach the branch (and
    through it, the city/zone) via `hub.branch` - the city -> branch -> hub
    -> local office chain is the network's full location hierarchy.
    """
    __tablename__ = "local_offices"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    status = Column(String(50), default="active")  # e.g., "active", "inactive"

    hub_id = Column(UUID_TYPE, ForeignKey("hubs.id"), nullable=False)
    hub = relationship("Hub", back_populates="local_offices")

    manager_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    manager = relationship("User", back_populates="managed_local_offices")
