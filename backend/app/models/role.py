from sqlalchemy import Column, String, Integer
from app.database import Base


class Role(Base):
    """
    Roles are data, not hardcoded logic.
    Seed values: customer, staff, rider, admin, super_admin
    """
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
