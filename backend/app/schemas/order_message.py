from datetime import datetime
from pydantic import BaseModel


class OrderMessageCreate(BaseModel):
    body: str


class OrderMessageOut(BaseModel):
    id: str
    order_id: str
    sender_id: str
    sender_name: str | None = None
    sender_role: str | None = None
    body: str
    created_at: datetime

    class Config:
        from_attributes = True
