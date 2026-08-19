from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class BusOperatorIn(BaseModel):
    name: str
    city: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    status: Optional[str] = "active"


class BusOperatorOut(BusOperatorIn):
    model_config = ConfigDict(from_attributes=True)
    id: str


class BusOperatorUpdateIn(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    status: Optional[str] = None


class BusScheduleIn(BaseModel):
    operator_id: str
    origin_city: str
    destination_city: str
    origin_branch_id: Optional[str] = None
    destination_branch_id: Optional[str] = None
    departure_time: Optional[str] = None
    departure_interval_min: Optional[int] = 30
    fare: Optional[float] = None
    status: Optional[str] = "active"


class BusScheduleUpdateIn(BaseModel):
    operator_id: Optional[str] = None
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None
    origin_branch_id: Optional[str] = None
    destination_branch_id: Optional[str] = None
    departure_time: Optional[str] = None
    departure_interval_min: Optional[int] = None
    fare: Optional[float] = None
    status: Optional[str] = None


class BusScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    operator_id: str
    operator_name: Optional[str] = None
    origin_city: str
    destination_city: str
    origin_branch_id: Optional[str] = None
    destination_branch_id: Optional[str] = None
    departure_time: Optional[str] = None
    departure_interval_min: Optional[int] = None
    fare: Optional[float] = None
    status: Optional[str] = None


class ManifestItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    order_id: Optional[str] = None
    crate_label: Optional[str] = None
    scan_status: Optional[str] = None
    scanned_at: Optional[datetime] = None
    tracking_number: Optional[str] = None


class BusManifestIn(BaseModel):
    schedule_id: Optional[str] = None
    manifest_number: Optional[str] = None
    coach_number: Optional[str] = None
    departure_at: Optional[datetime] = None
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None


class BusManifestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    manifest_number: Optional[str] = None
    coach_number: Optional[str] = None
    departure_at: Optional[datetime] = None
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None
    status: Optional[str] = None
    operator_name: Optional[str] = None
    items: list[ManifestItemOut] = []


class ManifestStatusIn(BaseModel):
    status: str  # in_preparation / in_transit / arrived
    item_status: Optional[str] = None  # optional: scan all items to this status
    scanned_item_ids: Optional[list[str]] = None  # optional: only these items were physically scanned on arrival