from sqlalchemy import Column, Integer, String, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class PricingRule(Base, TimestampMixin):
    __tablename__ = "pricing_rules"
    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    zone_id = Column(UUID_TYPE, ForeignKey("zones.id"), nullable=False)
    zone = relationship("Zone", back_populates="pricing_rules")
    weight_range_min = Column(Integer, nullable=False)  # Minimum weight in grams
    weight_range_max = Column(Integer, nullable=False)  # Maximum weight in grams
    price = Column(Integer, nullable=False)  # Price in cents
    extra_per_kg = Column(Integer, nullable=True)  # Extra price per kg if weight exceeds weight_range_max
    fuel_surcharge_percentage = Column(Integer, nullable=True)  # Fuel surcharge percentage
    tax_percentage = Column(Integer, nullable=True)  # Tax percentage