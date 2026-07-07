import re
from pydantic import BaseModel, EmailStr, Field, field_validator

# E.164-ish format: optional +, 7-15 digits total. Adjust to your target country if needed.
PHONE_REGEX = re.compile(r"^\+?[0-9]{7,15}$")
CNIC_REGEX = re.compile(r"/^([0-9]{5})[\-]([0-9]{7})[\-]([0-9]{1})+/")


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    cnic: str = Field(..., min_length=13, max_length=20)
    password: str = Field(..., min_length=8, max_length=72)

    @field_validator("full_name")
    @classmethod
    def full_name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Full name cannot be blank")
        if not re.match(r"^[A-Za-z\s.'-]+$", v):
            raise ValueError("Full name can only contain letters, spaces, and . ' -")
        return v

    @field_validator("phone")
    @classmethod
    def phone_valid_format(cls, v: str) -> str:
        v = v.strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Phone number must be 7-15 digits, optionally starting with +")
        return v
    
    @field_validator("cnic")
    @classmethod
    def cnic_valid_format(cls, v: str) -> str:
        v = v.strip()
        # if not CNIC_REGEX.match(v):
        #     raise ValueError("Please enter correct CNIC")
        
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        # bcrypt silently truncates/errors past 72 bytes - reject early with a clear message
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 bytes")
        if not re.search(r"[A-Za-z]", v) or not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one letter and one number")
        return v


class AdminCreateUserRequest(RegisterRequest):
    """Used by admins to onboard staff/rider/admin accounts directly.
    Skips OTP verification since the admin is vouching for this person in person."""
    role: str = Field(..., pattern="^(staff|rider|admin|customer|super_admin)$")
    # branch_id: int = Field(...)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class SendOTPRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=20)

    @field_validator("phone")
    @classmethod
    def phone_valid_format(cls, v: str) -> str:
        v = v.strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Phone number must be 7-15 digits, optionally starting with +")
        return v


class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=20)
    otp_code: str = Field(..., min_length=6, max_length=6)

    @field_validator("otp_code")
    @classmethod
    def otp_numeric(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("OTP code must be 6 digits")
        return v
