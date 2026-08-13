import enum
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, Enum

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class DiscountType(str, enum.Enum):
    percentage = "percentage"
    flat = "flat"


class Discount(Base, TimestampMixin):
    """
    Layer 6 - Discounts. Promotions are only redeemable by signed-in users:
    the discount is validated against the authenticated customer at booking time,
    so an anonymous visitor can never apply it. A default first-shipment
    discount is seeded and auto-applied to a customer's first order.
    """
    __tablename__ = "discounts"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    code = Column(String(50), unique=True, nullable=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)

    discount_type = Column(Enum(DiscountType), default=DiscountType.percentage)
    value = Column(Float, nullable=False)         # e.g. 15.0 (percent) or 200.0 (flat PKR)
    max_discount_amount = Column(Float, nullable=True)  # cap for percentage discounts

    min_order_value = Column(Float, nullable=True)
    requires_login = Column(Boolean, default=True)

    is_auto_applied = Column(Boolean, default=False)   # applied to first order without a code
    max_uses = Column(Integer, nullable=True)
    uses_count = Column(Integer, default=0)

    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    def is_redeemable(self) -> bool:
        if not self.is_active:
            return False
        if self.max_uses is not None and self.uses_count >= self.max_uses:
            return False
        if self.expires_at and datetime.now(timezone.utc) > self.expires_at:
            return False
        return True

    def apply(self, amount: float) -> float:
        """Returns the discount amount (never negative, capped by max_discount_amount)."""
        if self.discount_type == DiscountType.percentage:
            discount = amount * (self.value / 100.0)
            if self.max_discount_amount is not None:
                discount = min(discount, self.max_discount_amount)
        else:
            discount = self.value
        return max(0.0, min(discount, amount))
