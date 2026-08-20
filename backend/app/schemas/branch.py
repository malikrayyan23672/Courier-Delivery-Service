from typing import Optional
from pydantic import BaseModel, Field, field_validator


class HubCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    address: Optional[str] = Field(None, max_length=255)
    zone_id: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=150)
    opening_time: Optional[str] = Field(None, max_length=10)
    closing_time: Optional[str] = Field(None, max_length=10)
    headquarter_id: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Hub name cannot be blank")
        return v


class HubOut(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    status: str

    class Config:
        from_attributes = True
