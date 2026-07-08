from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def create_log(
    db: Session,
    action: str,
    user_id: str | None = None,
    details: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> AuditLog:
    """
    Writes an audit log entry. `id` and `created_at` are DB-generated -
    never passed in by the caller.

    entity_type/entity_id are optional - pass them when logging an action
    against a specific record (e.g. entity_type="User", entity_id=user.id)
    so the audit trail can be filtered/queried by "everything that happened
    to this record", not just read as a flat text log.
    """
    log = AuditLog(
        action=action,
        user_id=user_id,
        details=details,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
