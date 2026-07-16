from pydantic import BaseModel, EmailStr
from typing import Optional


class UserOut(BaseModel):
    id: str
    full_name: str
    # email: EmailStr
    email: str
    phone: Optional[str] 
    cnic: str
    role: str
    is_active: bool
    is_verified: bool
    branch_id: str | None = None
    zone_id: str | None = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_role(cls, user):
        # branch_id = None
        # zone_id = None
        # if user.role.name == "staff" and user.staff_profile:
            # branch_id = str(user.staff_profile.branch_id) if user.staff_profile.branch_id else None
            # if user.staff_profile.branch:
                # zone_id = str(user.staff_profile.branch.zone_id) if user.staff_profile.branch.zone_id else None
        # elif user.role.name == "rider" and user.rider_profile:
            # branch_id = str(user.rider_profile.branch_id) if user.rider_profile.branch_id else None
            # if user.rider_profile.branch:
                # zone_id = str(user.rider_profile.branch.zone_id) if user.rider_profile.branch.zone_id else None

        return cls(
            id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
            cnic=str(user.cnic),
            role=user.role.name,
            is_active=user.is_active,
            is_verified=user.is_verified,
            # branch_id=branch_id,
            # zone_id=zone_id,
        )
