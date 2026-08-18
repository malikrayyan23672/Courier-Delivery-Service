import enum
import random
import string

from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class OrderStatus(str, enum.Enum):
    """
    The 8-state parcel journey (plus two operational extras: `assigned` - a
    rider has been offered the pickup but hasn't scanned it yet, and
    `cancelled` - killed before it ever entered the bus network). Transitions
    are enforced centrally by `order_service.transition()` - no route handler
    should assign `.status` directly.
    """
    created = "created"                    # BOOKED
    assigned = "assigned"                  # pickup offered to a rider
    picked_up = "picked_up"                # PICKED
    in_hub = "in_hub"                      # IN_HUB - scanned in at origin hub
    in_transit = "in_transit"              # IN_TRANSIT - manifest departed
    dest_hub = "dest_hub"                  # DEST_HUB - scanned in at destination hub
    out_for_delivery = "out_for_delivery"  # OUT_FOR_DELIVERY - last-mile rider assigned
    delivered = "delivered"                # DELIVERED
    failed = "failed"                      # a delivery attempt failed - may retry
    rto = "rto"                            # RTO - 3 attempts exhausted or buyer refused
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

    # native_enum=False -> stored as VARCHAR + Python-side validation, so adding
    # a new status later is a plain column default, never an `ALTER TYPE`.
    status = Column(Enum(OrderStatus, native_enum=False, length=30), default=OrderStatus.created, index=True)

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

    # Layer 6 - login-only discount applied at booking time.
    discount_id = Column(UUID_TYPE, ForeignKey("discounts.id"), nullable=True)
    discount_amount = Column(Float, nullable=True)

    # Layer 5 - Marketplace. Only set when this order originated from a direct
    # product purchase rather than a generic shipment booking. `unit_price` is
    # a snapshot at purchase time, since the product's live price can move.
    product_id = Column(UUID_TYPE, ForeignKey("products.id"), nullable=True)
    product = relationship("Product", back_populates="orders")
    quantity = Column(Integer, nullable=True)
    unit_price = Column(Float, nullable=True)

    # System 3 - Seller Portal. The single canonical "this is one of my
    # parcels" link for a seller, set on every order booked through the
    # seller portal (single booking, bulk upload) *and* every marketplace
    # order (mirrors product.business_id there) - one column every seller
    # query (dashboard, parcel list, returns) can filter on, instead of each
    # needing to know which of several paths created the order.
    seller_business_id = Column(UUID_TYPE, ForeignKey("businesses.id"), nullable=True, index=True)
    seller_business = relationship("Business", foreign_keys=[seller_business_id])

    proof_of_delivery_url = Column(String(500), nullable=True)
    proof_of_delivery_recipient_name = Column(String(150), nullable=True)

    payment = relationship("Payment", back_populates="order", uselist=False)
    settlement = relationship("Settlement", back_populates="order", uselist=False)
    manifest_items = relationship("ManifestItem", back_populates="order")
    tracking_events = relationship("TrackingEvent", back_populates="order", order_by="TrackingEvent.created_at")
    delivery_attempts = relationship("DeliveryAttempt", back_populates="order")
    invoice = relationship("Invoice", back_populates="order", uselist=False)
    ratings = relationship("Rating", back_populates="order")
