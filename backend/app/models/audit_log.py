from sqlalchemy import Column, String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid

class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    user = relationship("User")
    action = Column(String(100), nullable=False)  # e.g., "create_order", "update_status"
    entity_type = Column(String(50), nullable=False)  # e.g., "Order", "User"
    entity_id = Column(UUID_TYPE, nullable=False)
    details = Column(String(255), nullable=True)  # Optional details about the action