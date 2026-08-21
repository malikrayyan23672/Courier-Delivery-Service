import enum

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class SupportTicketStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class SupportTicket(Base, TimestampMixin):
    __tablename__ = "support_tickets"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)

    raised_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False, index=True)
    raised_by = relationship("User", foreign_keys=[raised_by_id])

    subject = Column(String(200), nullable=False)
    order_id = Column(UUID_TYPE, ForeignKey("orders.id", ondelete='CASCADE'), nullable=True)
    order = relationship("Order")

    status = Column(Enum(SupportTicketStatus, native_enum=False, length=20), default=SupportTicketStatus.open, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    messages = relationship(
        "SupportTicketMessage",
        back_populates="ticket",
        order_by="SupportTicketMessage.created_at",
        cascade="all, delete-orphan",
    )


class SupportTicketMessage(Base, TimestampMixin):
    __tablename__ = "support_ticket_messages"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)

    ticket_id = Column(UUID_TYPE, ForeignKey("support_tickets.id"), nullable=False, index=True)
    ticket = relationship("SupportTicket", back_populates="messages")

    sender_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    sender = relationship("User")

    body = Column(Text, nullable=False)
