import enum

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class IncidentType(str, enum.Enum):
    damaged = "damaged"
    missing = "missing"
    # Auto-raised by bus_network.update_manifest_status when a manifest's
    # scanned-off count doesn't match what was loaded (TRD: "discrepancy
    # triggers INCIDENT") - previously only a generic Log row, never a
    # first-class record a hub/admin could see and resolve.
    count_mismatch = "count_mismatch"


class IncidentStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"


class ParcelIncident(Base, TimestampMixin):
    """Hub-level incident log: damaged/missing parcels reported by staff, and
    manifest count-mismatch discrepancies - a real resolution workflow behind
    the branch console's "Report Damaged"/"Report Missing" actions, instead
    of those buttons just showing a toast with nothing persisted."""
    __tablename__ = "parcel_incidents"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    hub_id = Column(UUID_TYPE, ForeignKey("hubs.id"), nullable=False, index=True)
    hub = relationship("Hub")

    # Nullable - a "missing" report may not resolve to a known order/tracking
    # number at the moment it's raised.
    order_id = Column(UUID_TYPE, ForeignKey("orders.id", ondelete='CASCADE'), nullable=True)
    order = relationship("Order")
    manifest_id = Column(UUID_TYPE, ForeignKey("bus_manifests.id"), nullable=True)

    type = Column(Enum(IncidentType, native_enum=False, length=20), nullable=False)
    status = Column(Enum(IncidentStatus, native_enum=False, length=20), default=IncidentStatus.open, index=True)
    note = Column(Text, nullable=True)

    reported_by_id = Column(UUID_TYPE, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    reported_by = relationship("User", foreign_keys=[reported_by_id])

    resolution_note = Column(Text, nullable=True)
    resolved_by_id = Column(UUID_TYPE, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    resolved_at = Column(DateTime(timezone=True), nullable=True)
