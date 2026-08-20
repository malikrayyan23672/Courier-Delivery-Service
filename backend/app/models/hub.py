from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class Hub(Base, TimestampMixin):
    """
    A physical sorting/scan facility under a Branch (the branch is the city's
    main office). Hub operations themselves (scan-in/out, manifests,
    warehouse occupancy) still run against `Branch` in `app/api/v1/hub.py` -
    this model exists to give a hub its own location record and manager
    account, scoped to its parent branch.
    """
    __tablename__ = "hubs"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    status = Column(String(50), default="active")  # e.g., "active", "inactive"

    branch_id = Column(UUID_TYPE, ForeignKey("branches.id"), nullable=False)
    branch = relationship("Branch", back_populates="hubs")

    manager_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    manager = relationship("User", back_populates="managed_hubs")
