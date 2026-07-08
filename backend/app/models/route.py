from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class Route(Base, TimestampMixin):
    __tablename__ = "routes"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    origin = Column(String(150), nullable=False)
    destination = Column(String(150), nullable=False)
    distance_km = Column(Integer, nullable=False)  # Distance in kilometers
    estimated_time_min = Column(Integer, nullable=False)  # Estimated time in minutes
