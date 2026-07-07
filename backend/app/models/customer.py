from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False, unique=True)
    user = relationship("User", back_populates="customer_profile")
    customer_type = Column(String(50), default="regular")  # e.g., regular, premium, etc.
    loyalty_points = Column(Integer, default=0)
    preferred_payment_method = Column(String(50), default="credit_card")  # e.g., credit_card, paypal, etc.

    # # Orders this customer placed
    # orders_placed = relationship(
    #     "Order",
    #     foreign_keys="Order.customer_id",
    #     back_populates="customer",
    # )