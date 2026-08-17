from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class Product(Base, TimestampMixin):
    """
    Layer 5 - Marketplace. A listing a seller (Business) offers for direct
    purchase, as opposed to the bulk-upload shipments a seller books for
    their own external store. A marketplace purchase turns one `Product`
    into one `Order` (see marketplace_service.create_marketplace_order).
    """
    __tablename__ = "products"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    business_id = Column(UUID_TYPE, ForeignKey("businesses.id"), nullable=False, index=True)
    business = relationship("Business", back_populates="products")

    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True, index=True)
    price = Column(Float, nullable=False)
    stock_quantity = Column(Integer, nullable=False, default=0)
    unit_weight_kg = Column(Float, nullable=False, default=1.0)
    image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)

    orders = relationship("Order", back_populates="product")
