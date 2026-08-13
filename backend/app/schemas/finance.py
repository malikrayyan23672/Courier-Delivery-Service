from typing import Optional
from pydantic import BaseModel


class RiderWalletOut(BaseModel):
    rider_id: str
    full_name: str
    phone: Optional[str] = None
    cod_cash_held: float
    cod_wallet_locked: bool
    wallet_limit: float
    wallet_warning_at: float


class RiderWalletUnlockIn(BaseModel):
    note: str


class FinanceDashboardOut(BaseModel):
    cod_collected_total: float
    cod_pending_payout: float
    cod_paid_today: float
    open_disputes: int
    wallet_locked_riders: int
    wallet_locked_businesses: int
    sla_compliance_pct: float
