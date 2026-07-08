from typing import Optional
from pydantic import BaseModel, Field, field_validator


class ZoneCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=255)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Zone name cannot be blank")
        return v


class ZoneOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True
