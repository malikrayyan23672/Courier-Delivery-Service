from typing import Optional
from pydantic import BaseModel


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


class DeliveryOtpOut(BaseModel):
    message: str
    expires_in_minutes: int
