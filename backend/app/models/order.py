import enum
import random
import string

from sqlalchemy import Column, String, Float, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class OrderStatus(str, enum.Enum):
    created = "created"
    assigned = "assigned"
    picked_up = "picked_up"
    in_transit = "in_transit"
    delivered = "delivered"
    failed = "failed"
    cancelled = "cancelled"


class BookingChannel(str, enum.Enum):
    online = "online"        # customer booked via website/app
    walk_in = "walk_in"      # staff booked at the office counter
    phone = "phone"          # staff booked after a phone call


class CreatedByType(str, enum.Enum):
    customer = "customer"
    staff = "staff"


def generate_tracking_number():
    return "CR" + "".join(random.choices(string.digits, k=10))


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    tracking_number = Column(String(20), unique=True, default=generate_tracking_number, index=True)

    # Who the shipment belongs to (always a customer, even if booked by staff)
    customer_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    customer = relationship("User", foreign_keys=[customer_id], back_populates="orders_placed")

    # Who actually created the order record (audit trail)
    created_by_type = Column(Enum(CreatedByType), nullable=False, default=CreatedByType.customer)
    created_by_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    booking_channel = Column(Enum(BookingChannel), nullable=False, default=BookingChannel.online)

    pickup_address_id = Column(UUID_TYPE, ForeignKey("addresses.id"), nullable=False)
    dropoff_address_id = Column(UUID_TYPE, ForeignKey("addresses.id"), nullable=False)
    pickup_address = relationship("Address", foreign_keys=[pickup_address_id])
    dropoff_address = relationship("Address", foreign_keys=[dropoff_address_id])

    package_weight_kg = Column(Float, nullable=True)
    package_description = Column(String(255), nullable=True)

    status = Column(Enum(OrderStatus), default=OrderStatus.created, index=True)

    rider_id = Column(UUID_TYPE, ForeignKey("riders.id"), nullable=True)
    rider = relationship("RiderProfile", back_populates="deliveries")
    # None = offer awaiting rider response, True = accepted. Declining unassigns the order entirely.
    rider_accepted = Column(Boolean, nullable=True)

    zone_id = Column(UUID_TYPE, ForeignKey("zones.id"), nullable=True)
    branch_id = Column(UUID_TYPE, ForeignKey("branches.id"), nullable=True)
    zone = relationship("Zone")
    branch = relationship("Branch")

    estimated_price = Column(Float, nullable=True)
    final_price = Column(Float, nullable=True)

    proof_of_delivery_url = Column(String(500), nullable=True)

    payment = relationship("Payment", back_populates="order", uselist=False)
    tracking_events = relationship("TrackingEvent", back_populates="order", order_by="TrackingEvent.created_at")
    delivery_attempts = relationship("DeliveryAttempt", back_populates="order")
    invoice = relationship("Invoice", back_populates="order", uselist=False)
    live_tracking = relationship("LiveTracking", back_populates="order")
    status_history = relationship("OrderStatusHistory", back_populates="order")
    rider_assignments = relationship("RiderAssignment", back_populates="order")
