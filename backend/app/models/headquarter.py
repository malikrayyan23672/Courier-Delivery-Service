from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class Headquarter(Base, TimestampMixin):
    """
    The national head office - top tier of the network hierarchy
    (headquarter -> hub -> branch -> local branch). Every city Hub rolls up
    to the headquarter via `headquarter_id`.
    """
    __tablename__ = "headquarters"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(150), nullable=True)
    status = Column(String(50), default="active")  # e.g., "active", "inactive"

    manager_id = Column(UUID_TYPE, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    manager = relationship("User", back_populates="managed_headquarters")

    # Dissolving the national head office cascades to its city hubs.
    hubs = relationship("Hub", back_populates="headquarter", cascade="all, delete-orphan")