from sqlalchemy.orm import Session

from app.models.hub import Hub
from app.models.user import User


def resolve_city_hub_ids(current_user: User, db: Session) -> list[str] | None:
    """
    City-level data isolation. Returns None (unrestricted - caller may see
    every hub/city) for `super_admin`, and for anyone with no resolvable
    home hub - there's no city to scope to, and `admin` accounts created
    before this feature existed (the role has no hub-assignment path of
    its own) rely on that network-wide oversight already. Everyone with a
    home hub (`staff_profile.hub_id`, set for `manager`/`hub_manager`/
    `local_office_manager`/hub-assigned `staff`) gets every `Hub.id`
    sharing that hub's `zone_id` (their city) - callers filter
    `Order.hub_id.in_(...)`/reject an explicit `hub_id` query param
    that falls outside this list.
    """
    if current_user.role and current_user.role.name == "super_admin":
        return None

    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.hub_id:
        return None

    home_hub = db.query(Hub).filter(Hub.id == staff_profile.hub_id).first()
    if not home_hub or not home_hub.zone_id:
        return [str(staff_profile.hub_id)]

    hubs = db.query(Hub.id).filter(Hub.zone_id == home_hub.zone_id).all()
    return [str(h.id) for h in hubs]
