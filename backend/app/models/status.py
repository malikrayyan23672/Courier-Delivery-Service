from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class Status(Base):
    __tablename__ = "statuses"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(50), unique=True, nullable=False)  # e.g., "pending", "shipped", "delivered"
    description = Column(String(255), nullable=True)  # Optional description of the status
    