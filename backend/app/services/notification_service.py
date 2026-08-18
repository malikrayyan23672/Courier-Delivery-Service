from sqlalchemy.orm import Session

from app.core.ws_manager import push_to_rider
from app.models.notification import Notification


def notify(
    db: Session,
    user_id: str,
    title: str,
    message: str,
    type: str = "info",
    order_id: str | None = None,
) -> Notification:
    """
    Creates a Notification row (doesn't commit - same convention as
    order_service.transition(), caller's job) and, if the target user has a
    live rider WebSocket connection, pushes it immediately too. A rider
    without a live connection still sees it next time they open the app
    (GET /rider/notifications) - the WS push is a latency improvement, not
    the only delivery path.
    """
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        order_id=order_id,
    )
    db.add(notification)
    db.flush()

    push_to_rider(str(user_id), {
        "type": "new_assignment" if order_id else "notification",
        "notification_id": str(notification.id),
        "title": title,
        "message": message,
        "order_id": str(order_id) if order_id else None,
    })

    return notification
