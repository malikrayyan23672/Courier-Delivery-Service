from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DisputeCreateIn(BaseModel):
    order_id: str
    reason: str


class DisputeResolveIn(BaseModel):
    accepted: bool  # True = resolved in the seller's favor, False = rejected
    note: Optional[str] = None


class DisputeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    tracking_number: Optional[str] = None
    business_id: Optional[str] = None
    company_name: Optional[str] = None
    raised_by_id: str
    reason: str
    status: str
    resolution_note: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
