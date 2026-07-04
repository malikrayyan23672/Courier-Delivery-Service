from sqlalchemy import Column, String, Float
from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class Address(Base, TimestampMixin):
    __tablename__ = "addresses"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    label = Column(String(50), nullable=True)          # "Home", "Office" etc
    full_address = Column(String(500), nullable=False)
    city = Column(String(100), nullable=True)
    contact_name = Column(String(150), nullable=True)
    contact_phone = Column(String(20), nullable=True)

    # Server-side geocoded, never trust client-supplied coordinates for pricing
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
