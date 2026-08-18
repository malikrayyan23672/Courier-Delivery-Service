from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.core.ws_manager import manager
from app.database import SessionLocal
from app.models.rider import RiderProfile
from app.models.user import User

router = APIRouter(prefix="/ws", tags=["WebSocket"])


@router.websocket("/rider")
async def rider_socket(ws: WebSocket, token: str = Query(...)):
    """
    Push-only channel: once connected, the rider app receives events (new
    assignment offers, etc.) but never sends anything back over this socket.

    Auth rides in the query string because browsers/Flutter's WebSocket API
    can't set custom headers on the handshake - this mirrors the same
    decode_token()/is_active checks get_current_user() does for HTTP, plus a
    role check, since a WS 401 doesn't exist (1008 - policy violation - is
    the closest WS equivalent).
    """
    db: Session = SessionLocal()
    try:
        payload = decode_token(token)
        if payload is None or payload.get("type") != "access":
            await ws.close(code=1008)
            return

        user = db.query(User).filter(User.id == payload.get("sub")).first()
        if user is None or not user.is_active or user.role.name != "rider":
            await ws.close(code=1008)
            return

        if not user.rider_profile:
            # Mirrors _rider_profile()'s auto-create fallback in rider.py -
            # a WS connection could in principle arrive before the rider has
            # ever hit a REST endpoint that creates their profile row.
            db.add(RiderProfile(user_id=user.id))
            db.commit()

        # Keyed by User.id, not RiderProfile.id - this matches
        # Notification.user_id and the `user_id=rider.user_id` the push
        # points already pass to notification_service.notify().
        user_id = str(user.id)
    finally:
        db.close()

    await manager.connect(user_id, ws)
    try:
        while True:
            # This is push-only; we just block on receive() to detect
            # disconnects. Any inbound message is ignored.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, ws)
