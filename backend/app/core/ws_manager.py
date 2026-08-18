import asyncio
import json

from fastapi import WebSocket


class ConnectionManager:
    """
    In-process registry of live rider WebSocket connections, keyed by the
    rider's User.id (matches Notification.user_id, and the JWT `sub` claim).
    A rider can have more than one device/tab connected (phone + a second
    device mid-handoff), so each key holds a set, not a single socket.

    In-process only - if this API ever runs multiple worker processes, a
    push would only reach riders connected to the same worker that handled
    the triggering request. At that point this needs a Redis pub/sub layer
    to fan out across workers. Not needed at this app's current scale.
    """

    def __init__(self) -> None:
        self.active: dict[str, set[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.active.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        sockets = self.active.get(user_id)
        if not sockets:
            return
        sockets.discard(ws)
        if not sockets:
            self.active.pop(user_id, None)

    async def send_to_rider(self, user_id: str, payload: dict) -> None:
        sockets = self.active.get(user_id)
        if not sockets:
            return
        message = json.dumps(payload)
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(message)
            except Exception:
                # Connection is gone but hasn't been cleaned up via the
                # route's disconnect handler yet - drop it here too rather
                # than raising and blocking delivery to the rider's other
                # connected devices.
                dead.append(ws)
        for ws in dead:
            sockets.discard(ws)
        if not sockets:
            self.active.pop(rider_id, None)


manager = ConnectionManager()

# Reference to the server's main event loop, captured once at startup (see
# main.py's startup hook). Needed because every current caller of
# push_to_rider() (create_order/_auto_assign_rider, staff_assign_rider,
# admin's assign_rider) is a sync `def` FastAPI route - Starlette runs those
# in a worker thread pool, not on the event loop thread, so
# asyncio.get_running_loop() inside that thread raises RuntimeError and
# would silently no-op every push. run_coroutine_threadsafe is the correct
# way to schedule a coroutine on a loop from a different thread.
_main_loop: asyncio.AbstractEventLoop | None = None


def set_main_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _main_loop
    _main_loop = loop


def push_to_rider(rider_id: str, payload: dict) -> None:
    """
    Sync-safe entry point for route handlers/services that aren't `async
    def` - schedules the actual async send onto the captured main loop
    rather than blocking. If the main loop hasn't been captured yet (e.g.
    called from a script/shell outside the running app), the push is
    silently skipped - there's no live WebSocket client to reach in that
    case anyway.
    """
    if _main_loop is None:
        return
    asyncio.run_coroutine_threadsafe(manager.send_to_rider(rider_id, payload), _main_loop)
