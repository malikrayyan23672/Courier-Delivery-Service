from sqlalchemy import Column, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid
from app.models.rider_status_request import RequestStatus


class ParcelUnlockRequest(Base, TimestampMixin):
    """
    A rider's request to be released from a parcel they've already claimed/
    been assigned (order.status == assigned, before pickup) - needs staff/
    admin approval before the parcel actually unassigns and goes back to the
    pool. See PATCH /staff/unlock-requests/{id}/resolve.
    """
    __tablename__ = "parcel_unlock_requests"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)

    order_id = Column(UUID_TYPE, ForeignKey("orders.id"), nullable=False, index=True)
    order = relationship("Order")

    rider_id = Column(UUID_TYPE, ForeignKey("riders.id"), nullable=False, index=True)
    rider = relationship("RiderProfile")

    requested_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    requested_by = relationship("User", foreign_keys=[requested_by_id])

    reason = Column(String(500), nullable=True)

    status = Column(Enum(RequestStatus, native_enum=False, length=20), default=RequestStatus.pending, index=True)
    resolution_note = Column(String(500), nullable=True)
    resolved_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    resolved_at = Column(DateTime(timezone=True), nullable=True)
