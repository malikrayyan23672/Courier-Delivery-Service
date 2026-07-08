from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class User(Base, TimestampMixin):
    """
    A single users table for all roles (customer, staff, rider, admin, super_admin).
    Role-specific extra data lives in separate profile tables (RiderProfile, StaffProfile)
    to keep this table lean and avoid nullable-everything columns.
    """
    __tablename__ = "users"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    cnic = Column(String(15), unique=True, default=None, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    avatar = Column(String(255), default=None, nullable=True)

    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    role = relationship("Role")

    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    # Orders this user placed as a customer
    orders_placed = relationship(
        "Order",
        foreign_keys="Order.customer_id",
        back_populates="customer",
    )

    rider_profile = relationship("RiderProfile", back_populates="user", uselist=False)
    staff_profile = relationship("StaffProfile", back_populates="user", uselist=False)
    customer_profile = relationship("Customer", back_populates="user", uselist=False)
    managed_branches = relationship("Branch", back_populates="manager")
    managed_warehouses = relationship("Warehouse", back_populates="manager")
    notifications = relationship("Notification", back_populates="user")

    # last_login_at = Column(TimestampMixin.TIMESTAMP_TYPE, default=None, nullable=True)
    # deleted_at = Column(TimestampMixin.TIMESTAMP_TYPE, default=None, nullable=True)
