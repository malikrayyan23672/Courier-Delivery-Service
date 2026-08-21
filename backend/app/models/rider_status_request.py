import enum

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class RequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class RiderStatusRequest(Base, TimestampMixin):
    """
    A rider's request to change their own is_available flag - takes effect
    only once a staff/admin approver resolves it (see PATCH
    /staff/availability-requests/{id}/resolve). Mirrors the courier's
    real-world "request to go online/offline" workflow rather than letting
    the toggle apply instantly.
    """
    __tablename__ = "rider_status_requests"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)

    rider_id = Column(UUID_TYPE, ForeignKey("riders.id"), nullable=False, index=True)
    rider = relationship("RiderProfile")

    requested_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    requested_by = relationship("User", foreign_keys=[requested_by_id])

    requested_is_available = Column(Boolean, nullable=False)
    note = Column(String(500), nullable=True)

    status = Column(Enum(RequestStatus, native_enum=False, length=20), default=RequestStatus.pending, index=True)
    resolution_note = Column(String(500), nullable=True)
    resolved_by_id = Column(UUID_TYPE, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    resolved_at = Column(DateTime(timezone=True), nullable=True)
