from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DiscountIn(BaseModel):
    code: Optional[str] = None
    title: str
    description: Optional[str] = None
    discount_type: str = "percentage"   # percentage / flat
    value: float
    max_discount_amount: Optional[float] = None
    min_order_value: Optional[float] = None
    requires_login: bool = True
    is_auto_applied: bool = False
    max_uses: Optional[int] = None
    is_active: bool = True
    expires_at: Optional[datetime] = None


class DiscountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    code: Optional[str] = None
    title: str
    description: Optional[str] = None
    discount_type: Optional[str] = None
    value: float
    max_discount_amount: Optional[float] = None
    min_order_value: Optional[float] = None
    requires_login: bool = True
    is_auto_applied: bool = False
    max_uses: Optional[int] = None
    uses_count: Optional[int] = 0
    is_active: bool = True
    expires_at: Optional[datetime] = None


class DiscountPublicOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    discount_type: str
    value: float
    max_discount_amount: Optional[float] = None
    min_order_value: Optional[float] = None
    expires_at: Optional[datetime] = None