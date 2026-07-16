from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.core.permissions import require_roles
from app.models.staff import StaffProfile
from app.models.user import User
from app.models.branch import Branch
from typing import Optional

router = APIRouter(prefix="/manager", tags=["Manager"])


class ManagerProfileOut(BaseModel):
    manager_id: str
    full_name: str
    phone: str


class BranchLocationOut(BaseModel):
    id: str
    name: str
    address: str
    manager_id: str
    phone: Optional[str]
    email: Optional[str]
    latitude: str | None
    longitude: str | None


@router.get("/me", response_model=ManagerProfileOut)
def my_profile(
    db: Session = Depends(get_db),
    # widened to match every role your branch console actually loads for
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
):
    # current_user.manager_profile never existed - the real relationship on
    # User is staff_profile. Admins have no staff_profile at all, so fall
    # back to the logged-in user's own info rather than crashing/403ing.
    staff_profile = current_user.staff_profile

    return ManagerProfileOut(
        manager_id=staff_profile.id if staff_profile else current_user.id,
        full_name=current_user.full_name,
        phone=current_user.phone,
    )

# @router.get('/branch/location', response_model=BranchLocationOut)
# def branch_location(db: Session = Depends(get_db), current_user: User = Depends(require_roles("staff", "admin", "super_admin"))):

#     branch = db.query(Branch).filter(Branch.manager_id == current_user.id).first()

#     if not branch:
#         raise HTTPException(status_code=400, detail=f"could not found branch manager_id = {current_user.staff_profile.id}")

#     return BranchLocationOut(
#         id=branch.id,
#         name=branch.name,
#         address=branch.address,
#         manager_id=branch.manager_id,
#         phone=branch.phone,
#         email=branch.email,
#         latitude=branch.latitude,
#         longitude=branch.longitude

#     )

@router.get('/branch/location', response_model=BranchLocationOut)
def branch_location(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin")),
):
    staff_profile = current_user.staff_profile
    # staff_profile = db.query(StaffProfile).filter(StaffProfile.id == staff_profile.id)

    if not staff_profile:
        raise HTTPException(
            status_code=400,
            detail="staff profile not found"
        )
    # manager_lookup_id = staff_profile.user_id if staff_profile else current_user.id

    branch = db.query(Branch).filter(Branch.manager_id == staff_profile.user_id).first()

    if not branch:
        raise HTTPException(
            status_code=400,
            detail=f"could not find branch for manager_id = {staff_profile.user_id}"
        )

    return BranchLocationOut(
        id=branch.id,
        name=branch.name,
        address=branch.address,
        manager_id=branch.manager_id,
        phone=branch.phone,
        email=branch.email,
        latitude=branch.latitude,
        longitude=branch.longitude,
    )