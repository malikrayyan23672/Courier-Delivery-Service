from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    title: str
    type: str
    message: str
    is_read: bool
    order_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
