import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.address import Address
from app.models.business import Business
from app.models.bus_network import ManifestItem
from app.models.order import CreatedByType, BookingChannel, Order, OrderStatus
from app.models.payment import PaymentMethod
from app.models.product import Product
from app.models.rating import Rating
from app.models.rnp import RNPPartner
from app.models.seller_upload import SellerUpload
from app.models.tracking_event import TrackingEvent
from app.models.delivery_attempt import DeliveryAttempt
from app.models.order_message import OrderMessage
from app.models.wallet import WalletTransaction
from app.models.settlement import Settlement
from app.utils.uploads import save_seller_upload, save_product_image
from app.schemas.order import AddressInput
from app.schemas.seller import (
    SellerMeOut, SellerUploadOut, SellerOrderCreateRequest, ParcelRowOut,
    BulkUploadRowIn, BulkUploadPreviewOut, BulkUploadRowPreview, BulkUploadConfirmRequest,
    ParcelCancelRequest, PHONE_REGEX,
)
from app.schemas.order import OrderOut, TrackingEventOut
from app.schemas.rnp import RNPCreateIn, RNPOut
from app.schemas.wallet import WalletTransactionOut
from app.schemas.marketplace import ProductIn, ProductUpdateIn, ProductOut, RatingOut, RatingSummaryOut
from app.schemas.order_message import OrderMessageCreate, OrderMessageOut
from app.services.order_service import create_order, get_or_create_guest_customer, cancel_order
from app.services import notification_service

router = APIRouter(prefix="/seller", tags=["Seller Portal"])

BULK_UPLOAD_COLUMNS = ["receiver_name", "receiver_phone", "receiver_address", "receiver_city", "weight_kg", "cod_amount"]


def _require_business(db: Session, user: User) -> Business:
    if not user.business_id:
        raise HTTPException(status_code=400, detail="No business account linked to this user")
    business = db.query(Business).filter(Business.id == user.business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business account not found")
    if (business.status or "active") != "active":
        raise HTTPException(
            status_code=403,
            detail=f"Your seller account is {business.status or 'inactive'}. Contact admin@raftaarexpress.com to resolve this.",
        )
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
    """Shipment volume trend + RTO rate for every parcel booked through this seller - marketplace sales and store shipments alike."""
    business = _require_business(db, current_user)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    orders_q = db.query(Order).filter(Order.seller_business_id == business.id)

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


@router.post("/products/upload-image")
def upload_product_image(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """Uploads a product photo and returns its URL - call before create/update so the URL can be included in that payload."""
    business = _require_business(db, current_user)
    url_path = save_product_image(str(business.id), image)
    return {"url": url_path}


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


# ============================== BOOK A SHIPMENT ==============================

def _seller_pickup(business: Business) -> AddressInput:
    return AddressInput(
        full_address=business.pickup_address, city=business.city,
        contact_name=business.company_name, contact_phone=business.phone,
    )


@router.post("/orders", response_model=OrderOut, status_code=201)
def book_single_order(
    payload: SellerOrderCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """A single shipment for the seller's own (external) customer - AWB generated instantly."""
    business = _require_business(db, current_user)
    receiver = get_or_create_guest_customer(db, full_name=payload.receiver_name, phone=payload.receiver_phone)

    dropoff = AddressInput(
        full_address=payload.receiver_address, city=payload.receiver_city,
        contact_name=payload.receiver_name, contact_phone=payload.receiver_phone,
    )

    order = create_order(
        db=db,
        customer_id=str(receiver.id),
        created_by_id=str(current_user.id),
        # `customer` (not `staff`) so create_order resolves zone/branch from
        # the pickup city - the `staff` branch instead looks up a
        # StaffProfile, which a business account doesn't have.
        created_by_type=CreatedByType.customer,
        booking_channel=BookingChannel.online,
        pickup=_seller_pickup(business),
        dropoff=dropoff,
        package_weight_kg=payload.weight_kg,
        package_description=f"COD Rs {payload.cod_amount:.0f}",
        payment_method=PaymentMethod.cash,
        allow_discount=False,
        quantity=1,
        unit_price=payload.cod_amount,
        seller_business_id=str(business.id),
    )
    return order


# ============================== PARCELS ==============================

@router.get("/parcels", response_model=list[ParcelRowOut])
def seller_parcels(
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """Every parcel booked through this seller - marketplace sales and store shipments alike."""
    business = _require_business(db, current_user)
    query = (
        db.query(Order)
        .options(joinedload(Order.dropoff_address), joinedload(Order.product))
        .filter(Order.seller_business_id == business.id)
    )
    if status_filter:
        query = query.filter(Order.status == status_filter)
    if q:
        like = f"%{q.strip()}%"
        query = query.join(Address, Order.dropoff_address_id == Address.id, isouter=True).filter(
            or_(Order.tracking_number.ilike(like), Address.contact_name.ilike(like), Address.contact_phone.ilike(like))
        )

    rows = query.order_by(Order.created_at.desc()).limit(300).all()
    return [
        ParcelRowOut(
            id=str(o.id),
            tracking_number=o.tracking_number,
            status=o.status.value if hasattr(o.status, "value") else o.status,
            source="marketplace" if o.product_id else "store",
            receiver_name=o.dropoff_address.contact_name if o.dropoff_address else None,
            receiver_phone=o.dropoff_address.contact_phone if o.dropoff_address else None,
            dropoff_city=o.dropoff_address.city if o.dropoff_address else None,
            cod_amount=round(o.unit_price * o.quantity, 2) if o.unit_price is not None and o.quantity is not None else None,
            created_at=o.created_at,
        )
        for o in rows
    ]


@router.get("/parcels/{tracking_number}")
def seller_parcel_detail(
    tracking_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """Full timeline + last known scan location for one parcel."""
    business = _require_business(db, current_user)
    order = (
        db.query(Order)
        .options(joinedload(Order.dropoff_address), joinedload(Order.pickup_address), joinedload(Order.tracking_events))
        .filter(Order.tracking_number == tracking_number.strip().upper(), Order.seller_business_id == business.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Parcel not found")

    events = sorted(order.tracking_events, key=lambda e: e.created_at)
    last_location = next((e for e in reversed(events) if e.lat is not None and e.lng is not None), None)

    return {
        "id": str(order.id),
        "tracking_number": order.tracking_number,
        "status": order.status.value if hasattr(order.status, "value") else order.status,
        "receiver_name": order.dropoff_address.contact_name if order.dropoff_address else None,
        "receiver_phone": order.dropoff_address.contact_phone if order.dropoff_address else None,
        "dropoff_full_address": order.dropoff_address.full_address if order.dropoff_address else None,
        "pickup_full_address": order.pickup_address.full_address if order.pickup_address else None,
        "package_weight_kg": order.package_weight_kg,
        "cod_amount": round(order.unit_price * order.quantity, 2) if order.unit_price is not None and order.quantity is not None else None,
        "final_price": order.final_price,
        "created_at": order.created_at,
        "timeline": [TrackingEventOut.model_validate(e).model_dump() for e in events],
        "last_lat": last_location.lat if last_location else None,
        "last_lng": last_location.lng if last_location else None,
    }


@router.patch("/parcels/{tracking_number}/cancel")
def cancel_seller_parcel(
    tracking_number: str,
    payload: ParcelCancelRequest = ParcelCancelRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    business = _require_business(db, current_user)
    order = (
        db.query(Order)
        .filter(Order.tracking_number == tracking_number.strip().upper(), Order.seller_business_id == business.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Parcel not found")

    cancel_order(db, order, actor=current_user, reason=payload.reason)
    db.commit()
    return {"message": "Order cancelled", "status": order.status.value if hasattr(order.status, "value") else order.status}


# ============================== BULK UPLOAD (CSV) ==============================

@router.get("/bulk-upload/template")
def bulk_upload_template():
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(BULK_UPLOAD_COLUMNS)
    writer.writerow(["Ali Khan", "03001234567", "House 12, Street 5, F-8 Markaz", "Islamabad", "1.5", "2500"])
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=raftaar_bulk_upload_template.csv"},
    )


def _validate_row_dict(data: dict) -> list[str]:
    errors = []
    if not data.get("receiver_name") or len(data["receiver_name"]) < 2:
        errors.append("Receiver name is required")
    if not data.get("receiver_phone") or not PHONE_REGEX.match(data["receiver_phone"]):
        errors.append("Valid receiver phone is required")
    if not data.get("receiver_address") or len(data["receiver_address"]) < 5:
        errors.append("Receiver address is required (min 5 characters)")
    if not data.get("receiver_city"):
        errors.append("Receiver city is required")
    try:
        weight = float(data.get("weight_kg", ""))
        if not (0 < weight <= 100):
            errors.append("Weight must be between 0 and 100 kg")
    except (ValueError, TypeError):
        errors.append("Weight must be a number")
    try:
        cod = float(data.get("cod_amount", ""))
        if cod < 0:
            errors.append("COD amount cannot be negative")
    except (ValueError, TypeError):
        errors.append("COD amount must be a number")
    return errors


@router.post("/bulk-upload/preview", response_model=BulkUploadPreviewOut)
def bulk_upload_preview(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """Parses and validates a CSV without creating any orders yet - call /bulk-upload/confirm with the result to actually book them."""
    business = _require_business(db, current_user)
    is_csv = (file.content_type in ("text/csv", "application/csv", "text/plain")) or (file.filename or "").lower().endswith(".csv")
    if not is_csv:
        raise HTTPException(status_code=400, detail="Please upload a .csv file built from the template.")

    raw = file.file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Could not read this file as UTF-8 text.")

    reader = csv.DictReader(io.StringIO(text))
    missing_cols = [c for c in BULK_UPLOAD_COLUMNS if c not in (reader.fieldnames or [])]
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"Missing column(s): {', '.join(missing_cols)}. Download the template for the exact format.")

    rows: list[BulkUploadRowPreview] = []
    for i, raw_row in enumerate(reader, start=2):  # row 1 is the header
        data = {k: (raw_row.get(k) or "").strip() for k in BULK_UPLOAD_COLUMNS}
        rows.append(BulkUploadRowPreview(row_number=i, data=data, errors=_validate_row_dict(data)))

    if not rows:
        raise HTTPException(status_code=400, detail="This file has no data rows.")

    valid_count = sum(1 for r in rows if not r.errors)

    file.file.seek(0)
    url_path, stored_filename, ext = save_seller_upload(str(business.id), file)
    upload = SellerUpload(
        business_id=business.id,
        original_filename=file.filename or stored_filename,
        stored_filename=stored_filename,
        file_path=url_path,
        file_type=ext,
        row_count=len(rows),
        status="uploaded",
        uploaded_by_id=current_user.id,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    return BulkUploadPreviewOut(upload_id=str(upload.id), valid_count=valid_count, error_count=len(rows) - valid_count, rows=rows)


@router.post("/bulk-upload/confirm")
def bulk_upload_confirm(
    payload: BulkUploadConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """Books one order per row that was valid in the preview step."""
    business = _require_business(db, current_user)
    upload = db.query(SellerUpload).filter(SellerUpload.id == payload.upload_id, SellerUpload.business_id == business.id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    if upload.status == "processed":
        raise HTTPException(status_code=400, detail="This upload has already been confirmed")

    created: list[str] = []
    failures: list[dict] = []
    pickup = _seller_pickup(business)

    for i, row in enumerate(payload.rows, start=1):
        errors = _validate_row_dict(row.model_dump())
        if errors:
            failures.append({"row": i, "error": "; ".join(errors)})
            continue
        try:
            receiver = get_or_create_guest_customer(db, full_name=row.receiver_name, phone=row.receiver_phone)
            dropoff = AddressInput(
                full_address=row.receiver_address, city=row.receiver_city,
                contact_name=row.receiver_name, contact_phone=row.receiver_phone,
            )
            order = create_order(
                db=db, customer_id=str(receiver.id), created_by_id=str(current_user.id),
                created_by_type=CreatedByType.customer, booking_channel=BookingChannel.online,
                pickup=pickup, dropoff=dropoff, package_weight_kg=row.weight_kg,
                package_description=f"COD Rs {row.cod_amount:.0f}", payment_method=PaymentMethod.cash,
                allow_discount=False, quantity=1, unit_price=row.cod_amount, seller_business_id=str(business.id),
            )
            created.append(order.tracking_number)
        except Exception as e:
            db.rollback()
            failures.append({"row": i, "error": str(e)})

    upload.status = "processed" if created else "failed"
    upload.row_count = len(payload.rows)
    db.commit()

    return {"created_count": len(created), "failed_count": len(failures), "tracking_numbers": created, "failures": failures}


# ============================== RETURNS / RTO ==============================

@router.get("/returns")
def seller_returns(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    """RTO parcels for this seller, with their return batch (if loaded onto a manifest yet) and a 48h SLA countdown."""
    business = _require_business(db, current_user)
    orders = (
        db.query(Order)
        .options(joinedload(Order.dropoff_address), joinedload(Order.tracking_events))
        .filter(Order.seller_business_id == business.id, Order.status == OrderStatus.rto)
        .order_by(Order.updated_at.desc())
        .all()
    )

    now = datetime.now(timezone.utc)
    rows = []
    for o in orders:
        events = sorted(o.tracking_events, key=lambda e: e.created_at)
        rto_event = next((e for e in events if e.status == OrderStatus.rto.value), None)
        rto_at = rto_event.created_at if rto_event else o.updated_at
        deadline = rto_at + timedelta(hours=48)
        hours_left = round((deadline - now).total_seconds() / 3600, 1)

        # A return batch is a manifest crate labeled RTO- for this order (see the hub's Returns view).
        item = db.query(ManifestItem).filter(ManifestItem.order_id == o.id, ManifestItem.crate_label.ilike("RTO-%")).first()

        last_attempt = (
            db.query(DeliveryAttempt)
            .filter(DeliveryAttempt.order_id == o.id)
            .order_by(DeliveryAttempt.attempt_number.desc())
            .first()
        )

        rows.append({
            "id": str(o.id),
            "tracking_number": o.tracking_number,
            "receiver_name": o.dropoff_address.contact_name if o.dropoff_address else None,
            "dropoff_city": o.dropoff_address.city if o.dropoff_address else None,
            "cod_amount": round(o.unit_price * o.quantity, 2) if o.unit_price is not None and o.quantity is not None else o.final_price,
            "rto_at": rto_at,
            "sla_hours_left": hours_left,
            "sla_breached": hours_left < 0,
            "batch_id": item.crate_label if item else None,
            "failure_note": last_attempt.notes if last_attempt else None,
            "failure_photo_url": last_attempt.photo_url if last_attempt else None,
            "collected_at": o.rto_collected_at,
        })
    return rows


# ---------------------------------------------------------------
# ORDER MESSAGES (seller <-> rider chat)
# ---------------------------------------------------------------
def _order_message_out(m: OrderMessage) -> OrderMessageOut:
    return OrderMessageOut(
        id=str(m.id),
        order_id=str(m.order_id),
        sender_id=str(m.sender_id),
        sender_name=m.sender.full_name if m.sender else None,
        sender_role=m.sender.role.name if m.sender and m.sender.role else None,
        body=m.body,
        created_at=m.created_at,
    )


def _seller_order(db: Session, current_user: User, order_id: str) -> Order:
    business = _require_business(db, current_user)
    order = db.query(Order).filter(Order.id == order_id, Order.seller_business_id == business.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/orders/{order_id}/messages", response_model=list[OrderMessageOut])
def list_seller_order_messages(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    order = _seller_order(db, current_user, order_id)
    messages = (
        db.query(OrderMessage)
        .filter(OrderMessage.order_id == order.id)
        .order_by(OrderMessage.created_at)
        .all()
    )
    return [_order_message_out(m) for m in messages]


@router.post("/orders/{order_id}/messages", response_model=OrderMessageOut)
def send_seller_order_message(
    order_id: str,
    payload: OrderMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("business")),
):
    order = _seller_order(db, current_user, order_id)
    message = OrderMessage(order_id=order.id, sender_id=current_user.id, body=payload.body.strip())
    db.add(message)

    if order.rider and order.rider.user_id:
        notification_service.notify(
            db, user_id=order.rider.user_id, title=f"New message about {order.tracking_number}",
            message=message.body[:200], order_id=order.id,
        )

    db.commit()
    db.refresh(message)
    return _order_message_out(message)