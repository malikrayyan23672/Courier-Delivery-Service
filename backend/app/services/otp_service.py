import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.phone_otp import PhoneOTP

OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 5
MAX_VERIFY_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60


def generate_otp_code() -> str:
    return "".join(random.choices("0123456789", k=OTP_LENGTH))


def send_otp(db: Session, phone: str) -> PhoneOTP:
    """
    Creates and 'sends' an OTP for the given phone number.
    Replace the print() with a real Twilio call once credentials are set up
    (see app/config.py - TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).
    """
    recent = (
        db.query(PhoneOTP)
        .filter(PhoneOTP.phone == phone)
        .order_by(PhoneOTP.created_at.desc())
        .first()
    )
    if recent and recent.created_at:
        seconds_since_last = (datetime.now(timezone.utc) - recent.created_at).total_seconds()
        if seconds_since_last < RESEND_COOLDOWN_SECONDS:
            wait = int(RESEND_COOLDOWN_SECONDS - seconds_since_last)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait} seconds before requesting another OTP",
            )

    otp = PhoneOTP(
        phone=phone,
        otp_code=generate_otp_code(),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    db.add(otp)
    db.commit()
    db.refresh(otp)

    # TODO: replace with real SMS send via Twilio
    print(f"[stub SMS] Sending OTP {otp.otp_code} to {phone} (expires in {OTP_EXPIRY_MINUTES} min)")

    return otp


def verify_otp(db: Session, phone: str, otp_code: str) -> bool:
    otp = (
        db.query(PhoneOTP)
        .filter(PhoneOTP.phone == phone, PhoneOTP.is_used.is_(False))
        .order_by(PhoneOTP.created_at.desc())
        .first()
    )

    if not otp:
        raise HTTPException(status_code=400, detail="No pending OTP found for this phone number. Request a new one.")

    if otp.is_expired():
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    if otp.attempts >= MAX_VERIFY_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Please request a new OTP.")

    if otp.otp_code != otp_code:
        otp.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect OTP code")

    otp.is_used = True
    db.commit()
    return True
