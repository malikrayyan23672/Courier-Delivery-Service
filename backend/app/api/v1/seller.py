from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.business import Business
from app.models.order import Order, OrderStatus
from app.models.product import Product
from app.models.rating import Rating
from app.models.rnp import RNPPartner
from app.models.seller_upload import SellerUpload
from app.models.wallet import WalletTransaction
from app.models.settlement import Settlement
from app.utils.uploads import save_seller_upload
from app.schemas.seller import SellerMeOut, SellerUploadOut
from app.schemas.rnp import RNPCreateIn, RNPOut
from app.schemas.wallet import WalletTransactionOut
from app.schemas.marketplace import ProductIn, ProductUpdateIn, ProductOut, RatingOut, RatingSummaryOut

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


# ============================== MARKETPLACE ==============================

@router.get("/products", response_model=list[ProductOut])
def seller_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    business = _require_business(db, current_user)
    rows = (
        db.query(Product)
        .filter(Product.business_id == business.id)
        .order_by(Product.created_at.desc())
        .all()
    )
    return [ProductOut.model_validate(p) for p in rows]


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(
    payload: ProductIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    business = _require_business(db, current_user)
    product = Product(business_id=business.id, **payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return ProductOut.model_validate(product)


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    payload: ProductUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    business = _require_business(db, current_user)
    product = db.query(Product).filter(Product.id == product_id, Product.business_id == business.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return ProductOut.model_validate(product)


@router.get("/marketplace/orders")
def seller_marketplace_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """Orders placed against this seller's product listings - the pack-and-hand-to-rider queue."""
    business = _require_business(db, current_user)
    rows = (
        db.query(Order)
        .join(Product, Order.product_id == Product.id)
        .options(joinedload(Order.dropoff_address), joinedload(Order.customer), joinedload(Order.product))
        .filter(Product.business_id == business.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return [
        {
            "id": str(o.id),
            "tracking_number": o.tracking_number,
            "status": o.status.value if hasattr(o.status, "value") else o.status,
            "product_name": o.product.name if o.product else None,
            "quantity": o.quantity,
            "unit_price": o.unit_price,
            "final_price": o.final_price,
            "buyer_name": o.customer.full_name if o.customer else None,
            "buyer_phone": o.customer.phone if o.customer else None,
            "dropoff_city": o.dropoff_address.city if o.dropoff_address else None,
            "created_at": o.created_at,
        }
        for o in rows
    ]


@router.get("/marketplace/orders/{order_id}")
def seller_marketplace_order_detail(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """Full detail for one marketplace order - drives the printable packing slip."""
    business = _require_business(db, current_user)
    order = (
        db.query(Order)
        .join(Product, Order.product_id == Product.id)
        .options(joinedload(Order.dropoff_address), joinedload(Order.pickup_address), joinedload(Order.customer), joinedload(Order.product))
        .filter(Order.id == order_id, Product.business_id == business.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "id": str(order.id),
        "tracking_number": order.tracking_number,
        "status": order.status.value if hasattr(order.status, "value") else order.status,
        "created_at": order.created_at,
        "product_name": order.product.name if order.product else None,
        "quantity": order.quantity,
        "unit_price": order.unit_price,
        "goods_amount": round((order.unit_price or 0.0) * (order.quantity or 1), 2),
        "delivery_fee": order.estimated_price,
        "discount_amount": order.discount_amount,
        "final_price": order.final_price,
        "payment_method": order.payment.method.value if order.payment and hasattr(order.payment.method, "value") else (order.payment.method if order.payment else None),
        "buyer_name": order.customer.full_name if order.customer else None,
        "buyer_phone": order.customer.phone if order.customer else None,
        "seller_name": business.company_name,
        "seller_phone": business.phone,
        "seller_address": order.pickup_address.full_address if order.pickup_address else business.pickup_address,
        "seller_city": order.pickup_address.city if order.pickup_address else business.city,
        "dropoff_full_address": order.dropoff_address.full_address if order.dropoff_address else None,
        "dropoff_city": order.dropoff_address.city if order.dropoff_address else None,
        "dropoff_contact_name": order.dropoff_address.contact_name if order.dropoff_address else None,
        "dropoff_contact_phone": order.dropoff_address.contact_phone if order.dropoff_address else None,
    }


@router.get("/ratings", response_model=RatingSummaryOut)
def seller_ratings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    business = _require_business(db, current_user)
    q = db.query(Rating).filter(Rating.target_type == "seller", Rating.target_business_id == business.id)
    avg = db.query(func.avg(Rating.score)).filter(Rating.target_type == "seller", Rating.target_business_id == business.id).scalar()
    rows = q.order_by(Rating.created_at.desc()).limit(50).all()
    return RatingSummaryOut(average=round(avg, 2) if avg is not None else None, count=q.count(), ratings=[RatingOut.model_validate(r) for r in rows])