import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

PHONE_REGEX = re.compile(r"^\+?[0-9]{7,15}$")


class SellerMeOut(BaseModel):
    business_id: str
    company_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    business_type: Optional[str] = None
    cod_service: Optional[bool] = False
    wallet_balance: Optional[int] = 0
    wallet_locked: Optional[bool] = False
    wallet_lock_reason: Optional[str] = None
    status: Optional[str] = None
    verified: bool = False


class SellerUploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    original_filename: str
    file_type: Optional[str] = None
    row_count: Optional[int] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None


class SellerOrderCreateRequest(BaseModel):
    """/seller/book - a single shipment for the seller's own (external) customer."""
    receiver_name: str = Field(..., min_length=2, max_length=150)
    receiver_phone: str = Field(..., min_length=7, max_length=20)
    receiver_address: str = Field(..., min_length=5, max_length=500)
    receiver_city: str = Field(..., min_length=1, max_length=100)
    weight_kg: float = Field(..., gt=0, le=100)
    cod_amount: float = Field(..., ge=0)

    @field_validator("receiver_phone")
    @classmethod
    def phone_valid(cls, v: str) -> str:
        v = v.strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Receiver phone must be 7-15 digits, optionally starting with +")
        return v


class ParcelRowOut(BaseModel):
    id: str
    tracking_number: str
    status: str
    source: str  # 'marketplace' | 'store'
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None
    dropoff_city: Optional[str] = None
    cod_amount: Optional[float] = None
    created_at: Optional[datetime] = None


class BulkUploadRowIn(BaseModel):
    receiver_name: str
    receiver_phone: str
    receiver_address: str
    receiver_city: str
    weight_kg: float
    cod_amount: float


class BulkUploadRowPreview(BaseModel):
    row_number: int
    data: dict
    errors: list[str] = []


class BulkUploadPreviewOut(BaseModel):
    upload_id: str
    valid_count: int
    error_count: int
    rows: list[BulkUploadRowPreview]


class BulkUploadConfirmRequest(BaseModel):
    upload_id: str
    rows: list[BulkUploadRowIn]