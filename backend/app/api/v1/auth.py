from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.role import Role
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    SendOTPRequest,
    VerifyOTPRequest,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.services.otp_service import send_otp, verify_otp

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        (User.email == payload.email) | (User.phone == payload.phone)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone already registered")

    customer_role = db.query(Role).filter(Role.name == "customer").first()
    if not customer_role:
        raise HTTPException(status_code=500, detail="Customer role not seeded. Run seed script first.")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        cnic=payload.cnic,
        hashed_password=hash_password(payload.password),
        role_id=customer_role.id,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Automatically send the first OTP so the user can verify right away
    send_otp(db, payload.phone)

    return {
        "message": "Registered successfully. An OTP has been sent to your phone for verification.",
        "user_id": str(user.id),
    }


@router.post("/send-otp")
def request_otp(payload: SendOTPRequest, db: Session = Depends(get_db)):
    """Resend an OTP - used if the first one expired or wasn't received."""
    send_otp(db, payload.phone)
    return {"message": "OTP sent"}


@router.post("/verify-otp")
def confirm_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    verify_otp(db, payload.phone, payload.otp_code)

    user = db.query(User).filter(User.phone == payload.phone).first()
    if user:
        user.is_verified = True
        db.commit()

    return {"message": "Phone number verified successfully"}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    # Deliberately vague error - don't reveal whether email exists
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Phone number not verified. Please verify via /auth/verify-otp before logging in.",
        )

    token_data = {"sub": str(user.id), "role": user.role.name}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = db.query(User).filter(User.id == decoded.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_data = {"sub": str(user.id), "role": user.role.name}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )
