from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User

router = APIRouter(prefix="/manager", tags=["Manager"])


class ManagerProfileOut(BaseModel):
    manager_id: str
    full_name: str
    phone: str


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