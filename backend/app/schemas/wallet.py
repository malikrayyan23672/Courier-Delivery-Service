from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class WalletOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_name: str
    email: Optional[str] = None
    wallet_balance: Optional[int] = 0
    wallet_locked: Optional[bool] = False
    wallet_lock_reason: Optional[str] = None
    status: Optional[str] = None


class WalletLockIn(BaseModel):
    lock: bool
    reason: Optional[str] = None


class WalletTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    amount: float
    balance_after: Optional[float] = None
    transaction_type: Optional[str] = None
    reference: Optional[str] = None
    created_at: Optional[datetime] = None


class ReconciliationIn(BaseModel):
    expected_amount: float = 0.0
    actual_amount: float = 0.0
    notes: Optional[str] = None


class ReconciliationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    expected_amount: float
    actual_amount: float
    difference: float
    status: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None