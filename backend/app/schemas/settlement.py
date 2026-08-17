from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class SettlementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    business_id: Optional[str] = None
    company_name: Optional[str] = None
    tracking_number: Optional[str] = None
    amount: float
    settle_due_on: Optional[datetime] = None
    status: str
    settled_at: Optional[datetime] = None
    remark: Optional[str] = None
    payout_method: Optional[str] = None
    receipt_url: Optional[str] = None
    created_at: Optional[datetime] = None


class SettleOneIn(BaseModel):
    payout_method: Optional[str] = None  # bank_transfer / wallet / cheque / cash
    receipt_url: Optional[str] = None    # uploaded proof of the payout


class SettleT1In(BaseModel):
    remark: Optional[str] = None
    payout_method: Optional[str] = None  # applied to every payout in the batch


class SettleResultOut(BaseModel):
    settled: list[SettlementOut] = []
    blocked: list[SettlementOut] = []
