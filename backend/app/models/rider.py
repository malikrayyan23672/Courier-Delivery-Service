from sqlalchemy import Column, String, Boolean, Float, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class RiderStatus(str, enum.Enum):
    pending_verification = "pending_verification"
    active = "active"
    suspended = "suspended"
    inactive = "inactive"


class RiderProfile(Base, TimestampMixin):
    __tablename__ = "rider_profiles"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), unique=True, nullable=False)

    branch_id = Column(UUID_TYPE, ForeignKey("branches.id"), nullable=True)
    branch = relationship("Branch", back_populates="riders")

    vehicle_type = Column(String(50), nullable=True)   # bike, van, truck
    license_number = Column(String(100), nullable=True)
    id_document_url = Column(String(500), nullable=True)

    status = Column(Enum(RiderStatus), default=RiderStatus.pending_verification)
    is_available = Column(Boolean, default=False)     # online/offline toggle

    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)

    rating = Column(Float, default=5.0)

    user = relationship("User", back_populates="rider_profile")
    deliveries = relationship("Order", back_populates="rider")

    status = Column(Enum(RiderStatus), default=RiderStatus.pending_verification)
