from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


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