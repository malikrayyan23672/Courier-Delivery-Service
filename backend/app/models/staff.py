from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class StaffProfile(Base, TimestampMixin):
    """
    Office/counter staff who book orders on behalf of walk-in customers.
    Tied to a physical branch/office location for accountability + reporting.
    """
    __tablename__ = "staff_profiles"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), unique=True, nullable=False)

    employee_code = Column(String(50), unique=True, nullable=True)
    branch_name = Column(String(150), nullable=True)
    branch_location = Column(String(255), nullable=True)

    user = relationship("User", back_populates="staff_profile")
