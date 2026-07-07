from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class ActivityLog(Base, TimestampMixin):
    __tablename__ = "activity_logs"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    user = relationship("User")
    action = Column(String(100), nullable=False)  # e.g., "login", "logout", "update_profile"
    details = Column(String(255), nullable=True)  # Optional details about the action