from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class Branch(Base, TimestampMixin):
    """
    A branch office under a city Hub. Branches are the mid-tier sorting/scan
    facilities of the network (headquarter -> hub -> branch -> local branch).
    Every LocalBranch (guest walk-in counter) belongs to exactly one Branch -
    see app/models/local_branch.py. The hub that owns this branch is reached
    via `hub`, and the headquarter above it via `hub.headquarter`.
    """
    __tablename__ = "branches"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    status = Column(String(50), default="active")  # e.g., "active", "inactive"

    hub_id = Column(UUID_TYPE, ForeignKey("hubs.id"), nullable=False)
    hub = relationship("Hub", back_populates="branches")

    manager_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    manager = relationship("User", back_populates="managed_branches")

    local_branches = relationship("LocalBranch", back_populates="branch")