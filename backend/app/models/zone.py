from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class Zone(Base, TimestampMixin):
    __tablename__ = "zones"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    branches = relationship("Branch", back_populates="zone")
    pricing_rules = relationship("PricingRule", back_populates="zone")
    