from sqlalchemy.orm import Session

from app.models.branch import Branch
from app.models.user import User


def resolve_city_branch_ids(current_user: User, db: Session) -> list[str] | None:
    """
    City-level data isolation. Returns None (unrestricted - caller may see
    every branch/city) for `super_admin`, and for anyone with no resolvable
    home branch - there's no city to scope to, and `admin` accounts created
    before this feature existed (the role has no branch-assignment path of
    its own) rely on that network-wide oversight already. Everyone with a
    home branch (`staff_profile.branch_id`, set for `manager`/`hub_manager`/
    `local_office_manager`/branch-assigned `staff`) gets every `Branch.id`
    sharing that branch's `zone_id` (their city) - callers filter
    `Order.branch_id.in_(...)`/reject an explicit `branch_id` query param
    that falls outside this list.
    """
    if current_user.role and current_user.role.name == "super_admin":
        return None

    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.branch_id:
        return None

    home_branch = db.query(Branch).filter(Branch.id == staff_profile.branch_id).first()
    if not home_branch or not home_branch.zone_id:
        return [str(staff_profile.branch_id)]

    branches = db.query(Branch.id).filter(Branch.zone_id == home_branch.zone_id).all()
    return [str(b.id) for b in branches]
