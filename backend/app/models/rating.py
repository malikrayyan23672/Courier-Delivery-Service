from sqlalchemy import Column, String, Integer, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class Rating(Base, TimestampMixin):
    """
    Layer 5 - Marketplace. A single 1-5 review left after a completed order,
    in either direction: a customer rating the seller, or the seller rating
    the customer (e.g. COD reliability). Always tied to the order that
    justifies it - no anonymous drive-by reviews.

    A guest buyer has no real account to key a customer-rating off of, so
    `target_phone` is always populated for a customer-target rating and is
    the canonical lookup key for guests (`target_user_id` still points at
    their auto-provisioned guest User row, but the phone is what a seller
    actually has on hand to check someone's history before accepting COD).
    """
    __tablename__ = "ratings"
    __table_args__ = (CheckConstraint("score >= 1 AND score <= 5", name="ck_rating_score_range"),)

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    order_id = Column(UUID_TYPE, ForeignKey("orders.id", ondelete='CASCADE'), nullable=False, index=True)
    order = relationship("Order", back_populates="ratings")

    rater_role = Column(String(20), nullable=False)     # 'customer' | 'seller'
    target_type = Column(String(20), nullable=False)    # 'seller' | 'customer'

    # Targets are kept (not deleted) if the rated party is removed.
    target_business_id = Column(UUID_TYPE, ForeignKey("businesses.id", ondelete='SET NULL'), nullable=True, index=True)
    target_user_id = Column(UUID_TYPE, ForeignKey("users.id", ondelete='SET NULL'), nullable=True, index=True)
    target_phone = Column(String(20), nullable=True, index=True)

    score = Column(Integer, nullable=False)
    comment = Column(String(500), nullable=True)
