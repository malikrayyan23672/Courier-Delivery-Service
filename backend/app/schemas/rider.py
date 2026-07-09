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

    class Config:
        from_attributes = True

class AvailabilityUpdate(BaseModel):
    is_available: bool


class AvailabilityOut(BaseModel):
    is_available: bool


class OfferResponse(BaseModel):
    accept: bool
