from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, DateTime

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class PhoneOTP(Base, TimestampMixin):
    """
    Stores OTP codes issued for phone verification.
    A new row is created each time an OTP is (re)sent - old rows for the
    same phone are simply superseded, never deleted (kept for audit/abuse tracking).
    """
    __tablename__ = "phone_otps"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    phone = Column(String(20), nullable=False, index=True)
    otp_code = Column(String(6), nullable=False)

    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)   # failed verification attempts against this code

    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expires_at
