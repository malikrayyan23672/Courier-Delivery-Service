from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class RNPCreateIn(BaseModel):
    shop_name: str
    owner_name: Optional[str] = None
    phone: str
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None


class RNPOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    shop_name: str
    owner_name: Optional[str] = None
    phone: str
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None


class RNPStatusIn(BaseModel):
    status: str  # approved / suspended
