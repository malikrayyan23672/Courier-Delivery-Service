from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.notification import Notification
from app.models.announcement import Announcement
from app.models.audit_log import AuditLog
from app.models.branch import Branch
from app.models.staff import StaffProfile
from app.models.rider import RiderProfile
from app.schemas.notification import NotificationOut
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])
admin_router = APIRouter(prefix="/admin", tags=["Admin - Notifications & Announcements"])


def _current_branch_id(db: Session, user: User) -> str | None:
    if user.staff_profile and user.staff_profile.branch_id:
        return str(user.staff_profile.branch_id)
    if user.rider_profile and user.rider_profile.branch_id:
        return str(user.rider_profile.branch_id)
    if user.managed_branches:
        return str(user.managed_branches[0].id)
    return None


@router.get("", response_model=dict)
def list_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "manager", "admin", "super_admin", "finance", "business", "rider", "customer")),
):
    """Every notification for the signed-in user, newest first, with an unread count."""
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
        .all()
    )
    return {
        "notifications": [NotificationOut.model_validate(n).model_dump() for n in rows],
        "unread": sum(1 for n in rows if not n.is_read),
    }


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_my_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "manager", "admin", "super_admin", "finance", "business", "rider", "customer")),
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/read-all", response_model=dict)
def mark_my_notifications_read_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "manager", "admin", "super_admin", "finance", "business", "rider", "customer")),
):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read.is_(False)).update(
        {Notification.is_read: True}
    )
    db.commit()
    return {"message": "All notifications marked as read"}


@router.get("/announcements", response_model=list[dict])
def list_visible_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "manager", "admin", "super_admin", "finance", "business", "rider")),
):
    """Active announcements - network-wide, or scoped to the caller's branch."""
    my_branch = _current_branch_id(db, current_user)
    now = datetime.now(timezone.utc)
    query = db.query(Announcement).filter(Announcement.is_active.is_(True))
    if my_branch:
        query = query.filter((Announcement.branch_id.is_(None)) | (Announcement.branch_id == my_branch))
    else:
        query = query.filter(Announcement.branch_id.is_(None))
    rows = query.order_by(Announcement.created_at.desc()).limit(50).all()
    out = []
    for a in rows:
        if a.expires_at and a.expires_at < now:
            continue
        out.append({
            "id": str(a.id),
            "title": a.title,
            "body": a.body,
            "branch_id": str(a.branch_id) if a.branch_id else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "created_by": a.created_by.full_name if a.created_by else None,
        })
    return out


@router.get("/activity", response_model=list[dict])
def recent_activity_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "manager", "admin", "super_admin", "finance")),
):
    """Recent immutable audit entries - powers the activity/audit feeds in the
    branch and super-admin consoles."""
    rows = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user))
        .order_by(AuditLog.created_at.desc())
        .limit(30)
        .all()
    )
    return [
        {
            "id": str(a.id),
            "action": a.action,
            "entity_type": a.entity_type,
            "entity_id": str(a.entity_id),
            "details": a.details,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "user": a.user.full_name if a.user else None,
            "user_role": a.user.role.name if a.user and a.user.role else None,
        }
        for a in rows
    ]


# ---------------------------------------------------------------
# SEND NOTIFICATION / ANNOUNCEMENTS (admin oversight)
# ---------------------------------------------------------------
class NotificationSendIn(BaseModel):
    title: str
    message: str
    type: str = "info"
    target: dict  # {"scope": "user"|"role"|"branch"|"all", "user_id"?: str, "role"?: str, "branch_id"?: str}


class AnnouncementIn(BaseModel):
    title: str
    body: str
    branch_id: str | None = None
    expires_at: str | None = None


def _resolve_target_users(db: Session, target: dict) -> list[User]:
    scope = target.get("scope")
    users: list[User] = []
    if scope == "user":
        uid = target.get("user_id")
        user = db.query(User).filter(User.id == uid).first()
        if user:
            users.append(user)
    elif scope == "role":
        role_name = target.get("role")
        users = db.query(User).join(User.role).filter(User.role.name == role_name, User.is_active.is_(True)).all()
    elif scope == "branch":
        bid = target.get("branch_id")
        if bid:
            staff_ids = [s.user_id for s in db.query(StaffProfile).filter(StaffProfile.branch_id == bid).all()]
            rider_ids = [r.user_id for r in db.query(RiderProfile).filter(RiderProfile.branch_id == bid).all()]
            branch = db.query(Branch).filter(Branch.id == bid).first()
            manager_id = str(branch.manager_id) if branch and branch.manager_id else None
            ids = set(staff_ids + rider_ids + ([manager_id] if manager_id else []))
            users = db.query(User).filter(User.id.in_(ids), User.is_active.is_(True)).all()
    elif scope == "all":
        users = db.query(User).filter(User.is_active.is_(True)).all()
    if not users:
        raise HTTPException(status_code=400, detail="No recipients matched this target")
    return users


@admin_router.post("/notifications/send")
def send_notification(
    payload: NotificationSendIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "manager")),
):
    """Broadcast a notification to one user, a role, a branch, or the whole network."""
    recipients = _resolve_target_users(db, payload.target)
    for u in recipients:
        notification_service.notify(
            db,
            user_id=str(u.id),
            title=payload.title,
            message=payload.message,
            type=payload.type,
        )
    db.commit()
    return {"message": f"Notification sent to {len(recipients)} recipient(s)"}


@admin_router.post("/announcements", status_code=201)
def create_announcement(
    payload: AnnouncementIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "manager")),
):
    if payload.branch_id:
        branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
    announcement = Announcement(
        title=payload.title,
        body=payload.body,
        branch_id=payload.branch_id,
        created_by_id=current_user.id,
    )
    if payload.expires_at:
        try:
            announcement.expires_at = datetime.fromisoformat(payload.expires_at)
        except ValueError:
            raise HTTPException(status_code=400, detail="expires_at must be ISO datetime")
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return {"id": str(announcement.id), "title": announcement.title, "body": announcement.body,
            "branch_id": str(announcement.branch_id) if announcement.branch_id else None,
            "is_active": announcement.is_active, "created_at": announcement.created_at}


@admin_router.get("/announcements", response_model=list[dict])
def list_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "manager")),
):
    rows = db.query(Announcement).options(joinedload(Announcement.created_by)).order_by(Announcement.created_at.desc()).all()
    return [
        {
            "id": str(a.id),
            "title": a.title,
            "body": a.body,
            "branch_id": str(a.branch_id) if a.branch_id else None,
            "branch_name": a.branch.name if a.branch else None,
            "is_active": a.is_active,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "created_by": a.created_by.full_name if a.created_by else None,
        }
        for a in rows
    ]


@admin_router.patch("/announcements/{announcement_id}")
def toggle_announcement(
    announcement_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "manager")),
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    if "is_active" in payload and isinstance(payload["is_active"], bool):
        announcement.is_active = payload["is_active"]
    if "body" in payload and isinstance(payload["body"], str):
        announcement.body = payload["body"]
    if "title" in payload and isinstance(payload["title"], str):
        announcement.title = payload["title"]
    db.commit()
    db.refresh(announcement)
    return {"id": str(announcement.id), "title": announcement.title, "is_active": announcement.is_active}


@admin_router.delete("/announcements/{announcement_id}", status_code=204)
def delete_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "manager")),
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(announcement)
    db.commit()