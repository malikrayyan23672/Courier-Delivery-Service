from sqlalchemy import Column, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class OrderMessage(Base, TimestampMixin):
    """
    An order-scoped chat message between the assigned rider and the parcel's
    seller - e.g. when a rider needs to explain a repeatedly failed delivery
    before it's returned to origin. Either side can send; there's no
    ticket/status lifecycle like SupportTicket, just a flat thread per order.
    """
    __tablename__ = "order_messages"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)

    order_id = Column(UUID_TYPE, ForeignKey("orders.id"), nullable=False, index=True)
    order = relationship("Order")

    sender_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    sender = relationship("User")

    body = Column(Text, nullable=False)
