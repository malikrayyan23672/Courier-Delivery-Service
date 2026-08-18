from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class RiderStatsOut(BaseModel):
    deliveries_today: int
    active_deliveries: int
    earnings_today: float


class RiderMeOut(BaseModel):
    full_name: str
    vehicle_type: Optional[str] = None
    status: str
    is_available: bool
    rating: float
    stats: RiderStatsOut
    cod_cash_held: float = 0.0
    cod_wallet_locked: bool = False
    cod_wallet_limit: float = 0.0
    cod_wallet_warning_at: float = 0.0

    class Config:
        from_attributes = True

class AvailabilityUpdate(BaseModel):
    is_available: bool


class AvailabilityOut(BaseModel):
    is_available: bool


class OfferResponse(BaseModel):
    accept: bool


class LocationUpdate(BaseModel):
    lat: float
    lng: float


class ReturnToHubRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None


class DeliveryOtpOut(BaseModel):
    message: str
    expires_in_minutes: int


# --- Availability change requests ---

class AvailabilityRequestCreate(BaseModel):
    requested_is_available: bool
    note: Optional[str] = Field(None, max_length=500)


class ResolveRequestPayload(BaseModel):
    approve: bool
    resolution_note: Optional[str] = Field(None, max_length=500)


class RiderStatusRequestOut(BaseModel):
    id: str
    rider_id: str
    rider_name: Optional[str] = None
    requested_by_id: str
    requested_is_available: bool
    note: Optional[str] = None
    status: str
    resolution_note: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Parcel unlock requests ---

class ParcelUnlockRequestCreate(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


class ParcelUnlockRequestOut(BaseModel):
    id: str
    order_id: str
    tracking_number: Optional[str] = None
    rider_id: str
    rider_name: Optional[str] = None
    requested_by_id: str
    reason: Optional[str] = None
    status: str
    resolution_note: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Manifest items (rider-facing) ---

class RiderManifestItemOut(BaseModel):
    id: str
    order_id: Optional[str] = None
    tracking_number: Optional[str] = None
    crate_label: Optional[str] = None
    scan_status: str
    scanned_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Support tickets ---

class SupportTicketCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=1)
    order_id: Optional[str] = None


class SupportTicketMessageCreate(BaseModel):
    body: str = Field(..., min_length=1)


class SupportTicketMessageOut(BaseModel):
    id: str
    sender_id: str
    sender_name: Optional[str] = None
    body: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SupportTicketOut(BaseModel):
    id: str
    raised_by_id: str
    raised_by_name: Optional[str] = None
    subject: str
    order_id: Optional[str] = None
    tracking_number: Optional[str] = None
    status: str
    resolved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    messages: list[SupportTicketMessageOut] = []

    class Config:
        from_attributes = True


class SupportTicketStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(open|in_progress|resolved|closed)$")


# --- Earnings ---

class EarningsDayOut(BaseModel):
    date: str
    earnings: float
    deliveries: int


class EarningsBreakdownOut(BaseModel):
    total_earnings: float
    total_deliveries: int
    daily: list[EarningsDayOut]
