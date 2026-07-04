from typing import Optional
from pydantic import BaseModel, Field


class AddressInput(BaseModel):
    label: Optional[str] = None
    full_address: str = Field(..., min_length=5, max_length=500)
    city: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None


class OrderCreateRequest(BaseModel):
    """Used by customers booking their own order online."""
    pickup_address: AddressInput
    dropoff_address: AddressInput
    package_weight_kg: Optional[float] = None
    package_description: Optional[str] = None


class StaffOrderCreateRequest(OrderCreateRequest):
    """
    Used by office staff booking on behalf of a walk-in customer.
    Either link an existing customer_id, or provide guest contact details
    to create a lightweight customer record.
    """
    customer_id: Optional[str] = None
    guest_full_name: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    payment_method: str = "cash"   # cash | card | online_gateway


class OrderOut(BaseModel):
    id: str
    tracking_number: str
    status: str
    booking_channel: str
    estimated_price: Optional[float] = None
    final_price: Optional[float] = None

    class Config:
        from_attributes = True
