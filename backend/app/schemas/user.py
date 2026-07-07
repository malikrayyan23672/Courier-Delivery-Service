from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone: str
    cnic: str
    role: str
    is_active: bool
    is_verified: bool

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_role(cls, user):
        return cls(
            id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
            cnic=str(user.cnic),
            role=user.role.name,
            is_active=user.is_active,
            is_verified=user.is_verified,
        )
