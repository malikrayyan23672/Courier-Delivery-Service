from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class LocalBranch(Base, TimestampMixin):
    """
    A guest-facing walk-in booking counter under a Branch - the bottom tier
    of the network hierarchy (headquarter -> hub -> branch -> local branch).
    Where a guest's parcel is booked (order.local_branch_id). Reach the hub
    (and through it, the headquarter) via `branch.hub`.
    """
    __tablename__ = "local_branches"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    status = Column(String(50), default="active")  # e.g., "active", "inactive"

    branch_id = Column(UUID_TYPE, ForeignKey("branches.id", ondelete='CASCADE'), nullable=False)
    branch = relationship("Branch", back_populates="local_branches")

    manager_id = Column(UUID_TYPE, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    manager = relationship("User", back_populates="managed_local_branches")