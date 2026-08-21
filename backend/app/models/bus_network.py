import enum
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class ManifestStatus(str, enum.Enum):
    in_preparation = "in_preparation"
    in_transit = "in_transit"
    arrived = "arrived"


class ScanStatus(str, enum.Enum):
    loaded = "loaded"
    in_transit = "in_transit"
    arrived = "arrived"
    delivered = "delivered"


class BusOperator(Base, TimestampMixin):
    """
    Layer 1 - Bus Network. Third-party inter-city bus operators (Faisal Movers,
    Warraich Express, Manthar Express...) that move Raftaar crates on their
    scheduled departures. Raftaar keeps zero fleet - the operator bears the
    vehicle/fuel cost.
    """
    __tablename__ = "bus_operators"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    city = Column(String(100), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    contact_email = Column(String(150), nullable=True)
    status = Column(String(50), default="active")  # active / inactive

    schedules = relationship("BusSchedule", back_populates="operator")


class BusSchedule(Base, TimestampMixin):
    """
    A recurring bus departure on a corridor. Dispatch frequency is encoded via
    `departure_interval_min` (target: every 30-45 minutes per corridor).
    """
    __tablename__ = "bus_schedules"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    operator_id = Column(UUID_TYPE, ForeignKey("bus_operators.id"), nullable=False)
    operator = relationship("BusOperator", back_populates="schedules")

    origin_city = Column(String(100), nullable=False)
    destination_city = Column(String(100), nullable=False)
    origin_hub_id = Column(UUID_TYPE, ForeignKey("hubs.id", ondelete='SET NULL'), nullable=True)
    destination_hub_id = Column(UUID_TYPE, ForeignKey("hubs.id", ondelete='SET NULL'), nullable=True)

    departure_time = Column(String(10), nullable=True)  # e.g. "06:30"
    departure_interval_min = Column(Integer, default=30)
    fare = Column(Float, nullable=True)
    status = Column(String(50), default="active")

    manifests = relationship("BusManifest", back_populates="schedule", cascade='all, delete-orphan')


class BusManifest(Base, TimestampMixin):
    """
    A concrete shipment of crates loaded onto one bus departure. This is what a
    hub scans at dispatch and what a customer/hub can track to see which bus is
    carrying their parcel.
    """
    __tablename__ = "bus_manifests"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    schedule_id = Column(UUID_TYPE, ForeignKey("bus_schedules.id", ondelete='CASCADE'), nullable=True)
    schedule = relationship("BusSchedule", back_populates="manifests")

    # Only set on auto-created RTO return batches (see order_service.
    # add_order_to_return_batch), which have no real BusSchedule yet - lets
    # that lookup find "the open return batch for hub X" without a join.
    origin_hub_id = Column(UUID_TYPE, ForeignKey("hubs.id"), nullable=True)

    manifest_number = Column(String(50), unique=True, nullable=True, index=True)
    coach_number = Column(String(50), nullable=True)  # e.g. bus registration/coach tag
    departure_at = Column(DateTime(timezone=True), nullable=True)

    origin_city = Column(String(100), nullable=True)
    destination_city = Column(String(100), nullable=True)

    status = Column(Enum(ManifestStatus), default=ManifestStatus.in_preparation, index=True)

    items = relationship("ManifestItem", back_populates="manifest", cascade='all, delete-orphan')


class ManifestItem(Base, TimestampMixin):
    """
    Crate-level tracking line on a manifest. Each scan (loaded -> in_transit ->
    arrived -> delivered) is recorded against a crate rather than a single order,
    so a whole busload can be updated with one scan.
    """
    __tablename__ = "manifest_items"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    manifest_id = Column(UUID_TYPE, ForeignKey("bus_manifests.id", ondelete='CASCADE'), nullable=False)
    manifest = relationship("BusManifest", back_populates="items")

    order_id = Column(UUID_TYPE, ForeignKey("orders.id", ondelete='CASCADE'), nullable=True)
    order = relationship("Order", back_populates="manifest_items")
    crate_label = Column(String(100), nullable=True)

    scan_status = Column(Enum(ScanStatus), default=ScanStatus.loaded, index=True)
    scanned_at = Column(DateTime(timezone=True), nullable=True)

    def scan(self, new_status: ScanStatus):
        self.scan_status = new_status
        self.scanned_at = datetime.now(timezone.utc)
