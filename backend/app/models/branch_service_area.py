from sqlalchemy import Column, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class BranchServiceArea(Base, TimestampMixin):
    """
    A neighbourhood-level coverage entry served by a branch - distinct from the
    coarser pricing `Zone` a branch belongs to. A branch typically serves
    several of these (e.g. "Gulberg / Liberty", "Model Town / Township").
    """
    __tablename__ = "branch_service_areas"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)

    hub_id = Column(UUID_TYPE, ForeignKey("hubs.id", ondelete='CASCADE'), nullable=False, index=True)
    hub = relationship("Hub", back_populates="service_areas")

    zone_name = Column(String(150), nullable=False)
    postal_codes = Column(String(100), nullable=True)
    radius_km = Column(Float, nullable=True)
    same_day = Column(Boolean, default=False)
    express = Column(Boolean, default=False)
