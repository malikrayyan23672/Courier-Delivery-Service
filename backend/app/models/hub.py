from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class Hub(Base, TimestampMixin):
    """
    A city-level hub - the main operational office for a city, sitting under
    the national Headquarter in the network hierarchy
    (headquarter -> hub -> branch -> local branch). Hubs own the branches in
    their city, and carry the operational attachments that used to hang off
    the old "branch" tier: staff, riders, warehouses, zones, service areas
    and the admin/manager accounts.
    """
    __tablename__ = "hubs"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=True)
    manager_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    manager = relationship("User", back_populates="managed_hubs", foreign_keys=[manager_id])
    # The hub's designated "admin" role account - distinct from `manager`
    # (day-to-day hub operations boss). One designated account per tier.
    admin_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    admin = relationship("User", back_populates="administered_hubs", foreign_keys=[admin_id])
    phone = Column(String(20), nullable=True)
    email = Column(String(150), nullable=True)
    latitude = Column(String(50), nullable=True)
    longitude = Column(String(50), nullable=True)
    opening_time = Column(String(10), nullable=True)  # e.g., "09:00 AM"
    closing_time = Column(String(10), nullable=True)
    status = Column(String(50), default="active")  # e.g., "active", "inactive"

    # Last-mile rider assignment mode for this hub's console: "manual" or
    # "automatic" (best available rider is offered the moment a parcel
    # arrives at this hub).
    rider_assignment_mode = Column(String(20), nullable=False, default="manual")

    # Rough capacity for the hub console's warehouse occupancy view (count of
    # parcels physically at this hub vs this number).
    warehouse_capacity = Column(Integer, nullable=True)

    headquarter_id = Column(UUID_TYPE, ForeignKey("headquarters.id"), nullable=True)
    headquarter = relationship("Headquarter", back_populates="hubs")

    zone_id = Column(UUID_TYPE, ForeignKey("zones.id"), nullable=True)
    zone = relationship("Zone", back_populates="hubs")
    staff_members = relationship("StaffProfile", back_populates="hub")
    riders = relationship("RiderProfile", back_populates="hub")
    warehouses = relationship("Warehouse", back_populates="hub")
    service_areas = relationship("BranchServiceArea", back_populates="hub", cascade="all, delete-orphan")
    branches = relationship("Branch", back_populates="hub")