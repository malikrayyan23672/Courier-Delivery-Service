from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class Announcement(Base, TimestampMixin):
    """
    Company/branch-wide announcements (e.g. "Warehouse closed for
    inventory count", "New COD policy effective Monday"). Optionally
    scoped to a single branch; null branch_id means network-wide.
    """
    __tablename__ = "announcements"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    title = Column(String(150), nullable=False)
    body = Column(String(1000), nullable=False)

    branch_id = Column(UUID_TYPE, ForeignKey("branches.id"), nullable=True)
    branch = relationship("Branch")

    created_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_id])

    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
