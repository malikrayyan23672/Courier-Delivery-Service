from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class Warehouse(Base, TimestampMixin):
    __tablename__ = "warehouses"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    # Relationship to the Branch model
    branch_id = Column(UUID_TYPE, ForeignKey("branches.id"), nullable=False)
    branch = relationship("Branch", back_populates="warehouses")

    manager_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    manager = relationship("User", back_populates="managed_warehouses")

    status = Column(String(50), default="active")  # e.g., "active", "inactive"