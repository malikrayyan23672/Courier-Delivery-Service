from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

from app.schemas.order import AddressInput, PHONE_REGEX


class ProductIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=2000)
    category: Optional[str] = Field(None, max_length=100)
    price: float = Field(..., gt=0)
    stock_quantity: int = Field(0, ge=0)
    unit_weight_kg: float = Field(1.0, gt=0, le=100.0)
    image_url: Optional[str] = Field(None, max_length=500)
    is_active: bool = True


class ProductUpdateIn(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=2000)
    category: Optional[str] = Field(None, max_length=100)
    price: Optional[float] = Field(None, gt=0)
    stock_quantity: Optional[int] = Field(None, ge=0)
    unit_weight_kg: Optional[float] = Field(None, gt=0, le=100.0)
    image_url: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class ProductOut(BaseModel):
    id: str
    business_id: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    stock_quantity: int
    unit_weight_kg: float
    image_url: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductPublicOut(ProductOut):
    """Adds the storefront-facing seller identity + aggregate rating."""
    seller_name: str
    seller_city: Optional[str] = None
    seller_rating_avg: Optional[float] = None
    seller_rating_count: int = 0


class MarketplaceCheckoutRequest(BaseModel):
    """
    Guest checkout works exactly like the authenticated flow, minus the
    discount and minus a real account - `guest_full_name` + `guest_phone` are
    required whenever the request has no bearer token (enforced in the route,
    since Pydantic alone can't see the auth state).
    """
    product_id: str
    quantity: int = Field(1, ge=1, le=999)
    dropoff_address: AddressInput
    payment_method: str = Field("cash", pattern="^(cash|card|online_gateway|wallet)$")
    discount_code: Optional[str] = Field(None, max_length=50)

    guest_full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    guest_phone: Optional[str] = Field(None, min_length=7, max_length=20)
    guest_email: Optional[str] = Field(None, max_length=150)

    @field_validator("guest_phone")
    @classmethod
    def guest_phone_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Guest phone must be 7-15 digits, optionally starting with +")
        return v


class MarketplaceOrderOut(BaseModel):
    id: str
    tracking_number: str
    status: str
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    goods_amount: float
    delivery_fee: float
    discount_amount: Optional[float] = None
    final_price: Optional[float] = None
    seller_name: str
    dropoff_full_address: str
    created_at: Optional[datetime] = None


class RatingIn(BaseModel):
    """
    Direction (who's rating whom) is inferred server-side from the requester,
    never taken from the client - a signed-in seller rates the customer, a
    guest or customer always rates the seller. See marketplace_service.submit_rating.
    """
    order_id: str
    score: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=500)
    # Only used when rating as a guest (no bearer token) - must match the
    # phone the order's guest checkout was placed under.
    rater_phone: Optional[str] = Field(None, max_length=20)


class RatingOut(BaseModel):
    id: str
    order_id: str
    rater_role: str
    target_type: str
    score: int
    comment: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RatingSummaryOut(BaseModel):
    average: Optional[float] = None
    count: int = 0
    ratings: list[RatingOut] = []
