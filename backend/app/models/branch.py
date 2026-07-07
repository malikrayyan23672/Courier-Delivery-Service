from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class Branch(Base, TimestampMixin):
    __tablename__ = "branches"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=True)
    manager_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    manager = relationship("User", back_populates="managed_branches")
    phone = Column(String(20), nullable=True)
    email = Column(String(150), nullable=True)
    latitude = Column(String(50), nullable=True)
    longitude = Column(String(50), nullable=True)
    opening_time = Column(String(10), nullable=True)  # e.g., "09:00 AM"
    closing_time = Column(String(10), nullable=True)  
    status = Column(String(50), default="active")  # e.g., "active", "inactive"

    zone_id = Column(UUID_TYPE, ForeignKey("zones.id"), nullable=True)
    zone = relationship("Zone", back_populates="branches")
    staff_members = relationship("StaffProfile", back_populates="branch")
    riders = relationship("RiderProfile", back_populates="branch")
    warehouses = relationship("Warehouse", back_populates="branch")