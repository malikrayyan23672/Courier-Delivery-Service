from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.business import Business
from app.models.order import Order, OrderStatus
from app.models.rnp import RNPPartner
from app.models.seller_upload import SellerUpload
from app.models.wallet import WalletTransaction
from app.models.settlement import Settlement
from app.utils.uploads import save_seller_upload
from app.schemas.seller import SellerMeOut, SellerUploadOut
from app.schemas.rnp import RNPCreateIn, RNPOut
from app.schemas.wallet import WalletTransactionOut

router = APIRouter(prefix="/seller", tags=["Seller Portal"])


def _require_business(db: Session, user: User) -> Business:
    if not user.business_id:
        raise HTTPException(status_code=400, detail="No business account linked to this user")
    business = db.query(Business).filter(Business.id == user.business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business account not found")
    return business


@router.get("/me", response_model=SellerMeOut)
def seller_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    business = _require_business(db, current_user)
    return SellerMeOut(
        business_id=str(business.id),
        company_name=business.company_name,
        email=business.email,
        phone=business.phone,
        business_type=business.business_type,
        cod_service=business.cod_service,
        wallet_balance=business.wallet_balance or 0,
        wallet_locked=business.wallet_locked,
        wallet_lock_reason=business.wallet_lock_reason,
        status=business.status,
        verified=current_user.is_verified,
    )


@router.get("/wallet/transactions", response_model=list[WalletTransactionOut])
def seller_wallet_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    business = _require_business(db, current_user)
    rows = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.business_id == business.id)
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )
    return [WalletTransactionOut.model_validate(t) for t in rows]


@router.get("/settlements")
def seller_settlements(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """COD payouts for this seller, each with its T+1 due date and status."""
    business = _require_business(db, current_user)
    rows = (
        db.query(Settlement)
        .filter(Settlement.business_id == business.id)
        .order_by(Settlement.created_at.desc())
        .all()
    )
    return [
        {
            "id": str(s.id),
            "order_id": str(s.order_id),
            "tracking_number": s.order.tracking_number if s.order else None,
            "amount": s.amount,
            "settle_due_on": s.settle_due_on,
            "status": s.status.value if hasattr(s.status, "value") else s.status,
            "settled_at": s.settled_at,
        }
        for s in rows
    ]


@router.get("/settlements/summary")
def seller_settlement_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    business = _require_business(db, current_user)
    pending = (
        db.query(Settlement)
        .filter(Settlement.business_id == business.id)
        .all()
    )
    pending_rows = [s for s in pending if (s.status.value if hasattr(s.status, "value") else s.status) == "pending"]
    return {
        "pending_count": len(pending_rows),
        "pending_amount": round(sum(s.amount for s in pending_rows), 2),
    }


@router.get("/analytics")
def seller_analytics(
    days: int = 14,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """Shipment volume trend + RTO rate for this seller's own orders."""
    business = _require_business(db, current_user)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    orders_q = (
        db.query(Order)
        .join(User, Order.customer_id == User.id)
        .filter(User.business_id == business.id)
    )

    status_rows = orders_q.with_entities(Order.status, func.count(Order.id)).group_by(Order.status).all()
    status_counts = {(s.value if hasattr(s, "value") else s): c for s, c in status_rows}
    total = sum(status_counts.values())
    rto_count = status_counts.get(OrderStatus.rto.value, 0)
    delivered_count = status_counts.get(OrderStatus.delivered.value, 0)
    resolved = delivered_count + rto_count
    rto_rate = round((rto_count / resolved) * 100, 1) if resolved else 0.0

    daily_rows = (
        orders_q.with_entities(func.date(Order.created_at), func.count(Order.id))
        .filter(Order.created_at >= since)
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
        .all()
    )
    daily = [{"date": str(d), "shipments": c} for d, c in daily_rows]

    return {
        "total_shipments": total,
        "rto_rate": rto_rate,
        "status_counts": status_counts,
        "daily_shipments": daily,
    }


@router.post("/uploads", response_model=SellerUploadOut, status_code=201)
def upload_bulk_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """Upload a bulk-order list (CSV, Excel, or Word) for the AI platform to parse later."""
    business = _require_business(db, current_user)
    url_path, stored_filename, ext = save_seller_upload(str(business.id), file)

    upload = SellerUpload(
        business_id=business.id,
        original_filename=file.filename or stored_filename,
        stored_filename=stored_filename,
        file_path=url_path,
        file_type=ext,
        status="uploaded",
        uploaded_by_id=current_user.id,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    return SellerUploadOut.model_validate(upload)


@router.get("/uploads", response_model=list[SellerUploadOut])
def seller_uploads(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    business = _require_business(db, current_user)
    rows = (
        db.query(SellerUpload)
        .filter(SellerUpload.business_id == business.id)
        .order_by(SellerUpload.created_at.desc())
        .all()
    )
    return [SellerUploadOut.model_validate(u) for u in rows]


@router.post("/rnp", response_model=RNPOut, status_code=201)
def register_rnp(
    payload: RNPCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """Register a Raftaar Neighbourhood Point (local shop drop/pickup node)."""
    business = _require_business(db, current_user)
    partner = RNPPartner(
        user_id=current_user.id,
        business_id=business.id,
        **payload.model_dump(),
    )
    db.add(partner)
    db.commit()
    db.refresh(partner)
    return RNPOut.model_validate(partner)


@router.get("/rnp", response_model=list[RNPOut])
def seller_rnp_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    business = _require_business(db, current_user)
    rows = (
        db.query(RNPPartner)
        .filter(RNPPartner.business_id == business.id)
        .order_by(RNPPartner.created_at.desc())
        .all()
    )
    return [RNPOut.model_validate(p) for p in rows]