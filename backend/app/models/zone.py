from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Float
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class Zone(Base, TimestampMixin):
    __tablename__ = "zones"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    # Layer 1 pricing - base fare for any shipment starting in this corridor,
    # plus the COD handling fee applied to cash-on-delivery amounts.
    base_rate = Column(Float, nullable=False, default=5.0)
    cod_fee_percentage = Column(Float, nullable=False, default=3.0)

    hubs = relationship("Hub", back_populates="zone")
    pricing_rules = relationship("PricingRule", back_populates="zone")
    