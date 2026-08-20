import re
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

# E.164-ish format: optional +, 7-15 digits total. Adjust to your target country if needed.
# PHONE_REGEX = re.compile(r"^\+?[0-9]{7,15}$")
PHONE_REGEX = re.compile(r"^((\+92)?(0092)?(92)?(0)?)(3\d{2}-\d{7}|3\d{9})$")
# Was `r"/^([0-9]{5})[\-]([0-9]{7})[\-]([0-9]{1})+/"` - stray leading/trailing
# `/` left over from a JS-style /regex/ literal (Python doesn't use those
# delimiters, so they became literal characters the pattern had to match,
# meaning it could never match a real CNIC), and a `+` on the last digit
# group that allowed trailing extra digits past the 13th. Both validators
# below had the actual check commented out as a result.
CNIC_REGEX = re.compile(r"^[0-9]{5}-[0-9]{7}-[0-9]{1}$")

class BusinessRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    phone: Optional[str] = Field(..., min_length=7, max_length=20)
    cnic: str = Field(..., min_length=13, max_length=20)
    cnic_photo_url: Optional[str] = Field(None, max_length=500)
    password: str = Field(..., min_length=8, max_length=72)
    business_name: str = Field(..., min_length=2, max_length=150)
    business_type: str = Field(..., min_length=2, max_length=150)
    business_registration_number: str = Field(..., min_length=10, max_length=150)
    ntn: str = Field(...,) #national tax number -> optional
    estimated_monthly_shipments: str = Field(...)
    business_address: str = Field(...)
    pickup_address: str = Field(...)
    city: str = Field(...)
    province: str = Field(...)
    postal_code: str = Field(...)
    country: str = Field(...)
    preffered_pickup_time: str = Field(...)
    cod_service: bool = Field(...)
    bank_name: str = Field(...)
    account_title: str = Field(...)
    account_number: str = Field(...)



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
            raise ValueError("Wrong phone number format")
        return v
    
    @field_validator("cnic")
    @classmethod
    def cnic_valid_format(cls, v: str) -> str:
        v = v.strip()
        if not CNIC_REGEX.match(v):
            raise ValueError("CNIC must be in the format 12345-1234567-1")
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




class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    phone: Optional[str] = Field(..., min_length=7, max_length=20)
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
    def phone_valid_format(cls, v: Optional[str]) -> Optional[str]:
        v = v.strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Wrong phone number format")
        return v
    
    @field_validator("cnic")
    @classmethod
    def cnic_valid_format(cls, v: str) -> str:
        v = v.strip()
        if not CNIC_REGEX.match(v):
            raise ValueError("CNIC must be in the format 12345-1234567-1")
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
    role: str = Field(..., pattern="^(staff|rider|admin|manager|hub_manager|local_office_manager|customer|super_admin)$")
    zone_id: str | None = Field(None, description="Zone ID for staff/rider assignment")
    hub_id: str | None = Field(None, description="Hub a staff/rider/manager/admin is attached to")
    designation: str | None = Field(None, description="Designation of each staff")
    branch_name: str | None = Field(None, description="Branch name for staff/rider assignment")
    branch_location: str | None = Field(None, description="Branch location for staff/rider assignment")
    branch_id: str | None = Field(None, description="Branch a hub_manager manages")
    local_branch_id: str | None = Field(None, description="Local branch a local_office_manager manages")


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
    phone: Optional[str] = Field(..., min_length=7, max_length=20)

    @field_validator("phone")
    @classmethod
    def phone_valid_format(cls, v: str) -> str:
        v = v.strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Wrong phone number format.")
        return v


class VerifyOTPRequest(BaseModel):
    phone: Optional[str] = Field(..., min_length=7, max_length=20)
    otp_code: str = Field(..., min_length=6, max_length=6)

    @field_validator("otp_code")
    @classmethod
    def otp_numeric(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("OTP code must be 6 digits")
        return v


class ForgotPasswordRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=20)

    @field_validator("phone")
    @classmethod
    def phone_valid_format(cls, v: str) -> str:
        v = v.strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Wrong phone number format.")
        return v


class ResetPasswordRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=20)
    otp_code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=72)

    @field_validator("otp_code")
    @classmethod
    def otp_numeric(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("OTP code must be 6 digits")
        return v

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 bytes")
        if not re.search(r"[A-Za-z]", v) or not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one letter and one number")
        return v
