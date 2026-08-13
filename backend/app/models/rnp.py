from sqlalchemy import Column, String, Float, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class RNPPartnerStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    suspended = "suspended"


class RNPPartner(Base, TimestampMixin):
    """
    Layer 3 - RNP Network. Raftaar Neighbourhood Points: local shops that act
    as drop-off / pick-up nodes for sellers and recipients in the same area.
    Registration is done from the seller portal; approval is manual by admin.
    """
    __tablename__ = "rnp_partners"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)

    # Optional linked user account that registered this RNP (a seller).
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    business_id = Column(UUID_TYPE, ForeignKey("businesses.id"), nullable=True)
    user = relationship("User", foreign_keys=[user_id])
    business = relationship("Business", foreign_keys=[business_id])

    shop_name = Column(String(150), nullable=False)
    owner_name = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=False)
    city = Column(String(100), nullable=True)
    address = Column(String(255), nullable=True)
    latitude = Column(String(50), nullable=True)
    longitude = Column(String(50), nullable=True)

    status = Column(Enum(RNPPartnerStatus), default=RNPPartnerStatus.pending, index=True)
    approved_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True)
    approved_at = Column(String(50), nullable=True)
