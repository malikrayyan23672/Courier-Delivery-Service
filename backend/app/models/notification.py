from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="notifications")
    title = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # e.g., "info", "warning", "error"
    message = Column(String(255), nullable=False)
    is_read = Column(Boolean, default=False)