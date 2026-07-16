from sqlalchemy import Column, String, Boolean, Integer
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class Business(Base, TimestampMixin):
    __tablename__ = "businesses"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    company_name = Column(String(150), nullable=False)
    business_type = Column(String(150), nullable=True)
    business_registration_number = Column(String(50), unique=True, nullable=False)
    ntn = Column(String(50), nullable=True)
    estimated_monthly_shipments = Column(String(50), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    business_address = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    wallet_balance = Column(Integer, default=0)
    credit_limit = Column(Integer, default=0)
    status = Column(String(50), default="active")
    is_active = Column(Boolean, default=True)

    pickup_address = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False)
    province = Column(String(100), nullable=False)
    postal_code = Column(String(20), nullable=False)
    country = Column(String(100), nullable=False)
    preferred_pickup_time = Column(String(100), nullable=False)
    cod_service = Column(Boolean, nullable=False, default=False)

    bank_name = Column(String(150), nullable=False)
    account_title = Column(String(150), nullable=False)
    account_number = Column(String(150), nullable=False)

    users = relationship("User", back_populates="business")