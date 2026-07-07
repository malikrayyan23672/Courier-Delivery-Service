from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class Business(Base, TimestampMixin):
    __tablename__ = "businesses"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    company_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    address = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    wallet_balance = Column(Integer, default=0)
    credit_limit = Column(Integer, default=0)
    status = Column(String(50), default="active")
    is_active = Column(Boolean, default=True)

    # Relationship to the User model
    users = relationship("User", back_populates="business")