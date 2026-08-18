from sqlalchemy import Column, String, Integer, Boolean, Float, Text
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class AssignmentRule(Base, TimestampMixin):
    """
    Rider auto-assignment configuration (superadmin). When a new order is
    created the dispatcher consults these in priority order - proximity
    (nearest available rider within a radius), load balancing, manual review
    for high-value COD, or branch-of-origin preference.
    """
    __tablename__ = "assignment_rules"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    rule_type = Column(String(50), nullable=False)  # proximity | load_balance | manual_only | branch_priority
    radius_km = Column(Float, nullable=True)
    active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    priority = Column(Integer, default=0)  # lower runs first


class MessageTemplate(Base, TimestampMixin):
    """
    Reusable messaging templates for the outbound notification engine - the
    SMS / WhatsApp / Email / Push messages sent at key lifecycle events
    (order created, rider assigned, out for delivery, delivered, COD
    collected, delivery failed). Placeholders like {tracking_number} are
    substituted at send time.
    """
    __tablename__ = "message_templates"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    trigger = Column(String(100), nullable=False)  # e.g. "Order Created", "Out for Delivery"
    channel = Column(String(20), nullable=False)   # SMS | WhatsApp | Email | Push
    body = Column(Text, nullable=False)
    subject = Column(String(150), nullable=True)   # used for Email
    active = Column(Boolean, default=True)