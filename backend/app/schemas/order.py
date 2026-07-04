import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator

PHONE_REGEX = re.compile(r"^\+?[0-9]{7,15}$")
MAX_PACKAGE_WEIGHT_KG = 100.0  # sanity ceiling - adjust to your fleet's real limits


class AddressInput(BaseModel):
    label: Optional[str] = Field(None, max_length=50)
    full_address: str = Field(..., min_length=5, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    contact_name: Optional[str] = Field(None, max_length=150)
    contact_phone: Optional[str] = Field(None, max_length=20)

    @field_validator("full_address")
    @classmethod
    def address_not_blank(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Address must be at least 5 characters")
        return v

    @field_validator("contact_phone")
    @classmethod
    def contact_phone_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return v
        v = v.strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Contact phone must be 7-15 digits, optionally starting with +")
        return v


class OrderCreateRequest(BaseModel):
    """Used by customers booking their own order online."""
    pickup_address: AddressInput
    dropoff_address: AddressInput
    package_weight_kg: Optional[float] = Field(None, gt=0, le=MAX_PACKAGE_WEIGHT_KG)
    package_description: Optional[str] = Field(None, max_length=255)


class StaffOrderCreateRequest(OrderCreateRequest):
    """
    Used by office staff booking on behalf of a walk-in customer.
    Either link an existing customer_id, or provide guest contact details
    to create a lightweight customer record.
    """
    customer_id: Optional[str] = None
    guest_full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    guest_phone: Optional[str] = Field(None, min_length=7, max_length=20)
    guest_email: Optional[str] = Field(None, max_length=150)
    payment_method: str = Field("cash", pattern="^(cash|card|online_gateway|wallet)$")

    @field_validator("guest_phone")
    @classmethod
    def guest_phone_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Guest phone must be 7-15 digits, optionally starting with +")
        return v


class OrderOut(BaseModel):
    id: str
    tracking_number: str
    status: str
    booking_channel: str
    estimated_price: Optional[float] = None
    final_price: Optional[float] = None

    class Config:
        from_attributes = True
