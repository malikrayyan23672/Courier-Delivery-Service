from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.order import Order

router = APIRouter(prefix="/tracking", tags=["Tracking"])


@router.get("/{tracking_number}")
def track_order(tracking_number: str, db: Session = Depends(get_db)):
    """
    Public endpoint - no auth required, since customers share tracking
    numbers with recipients who may not have an account.
    Rate-limit this in production to prevent tracking-number enumeration.
    """
    order = db.query(Order).filter(Order.tracking_number == tracking_number).first()
    if not order:
        raise HTTPException(status_code=404, detail="Tracking number not found")

    return {
        "tracking_number": order.tracking_number,
        "status": order.status,
        "history": [
            {"status": e.status, "note": e.note, "timestamp": e.created_at}
            for e in order.tracking_events
        ],
    }
