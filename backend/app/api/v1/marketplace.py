from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user_optional
from app.models.business import Business
from app.models.order import Order
from app.models.payment import PaymentMethod
from app.models.product import Product
from app.models.rating import Rating
from app.models.user import User
from app.schemas.marketplace import (
    ProductOut,
    ProductPublicOut,
    MarketplaceCheckoutRequest,
    MarketplaceOrderOut,
    RatingIn,
    RatingOut,
    RatingSummaryOut,
)
from app.services.marketplace_service import create_marketplace_order, submit_rating

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


def _rating_summary(db: Session, *, business_id: str | None = None, user_id: str | None = None, phone: str | None = None) -> tuple[float | None, int]:
    q = db.query(func.avg(Rating.score), func.count(Rating.id))
    if business_id:
        q = q.filter(Rating.target_type == "seller", Rating.target_business_id == business_id)
    elif phone:
        q = q.filter(Rating.target_type == "customer", Rating.target_phone == phone)
    elif user_id:
        q = q.filter(Rating.target_type == "customer", Rating.target_user_id == user_id)
    avg, count = q.first()
    return (round(avg, 2) if avg is not None else None), (count or 0)


@router.get("/products", response_model=list[ProductPublicOut])
def list_products(
    q: str | None = Query(None, description="Search by product name"),
    category: str | None = Query(None),
    business_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Product).options(joinedload(Product.business)).filter(Product.is_active.is_(True))
    if q:
        query = query.filter(Product.name.ilike(f"%{q.strip()}%"))
    if category:
        query = query.filter(Product.category == category)
    if business_id:
        query = query.filter(Product.business_id == business_id)

    products = query.order_by(Product.created_at.desc()).all()
    out = []
    for p in products:
        avg, count = _rating_summary(db, business_id=str(p.business_id))
        out.append(ProductPublicOut(
            id=str(p.id), business_id=str(p.business_id), name=p.name, description=p.description,
            category=p.category, price=p.price, stock_quantity=p.stock_quantity, unit_weight_kg=p.unit_weight_kg,
            image_url=p.image_url, is_active=p.is_active, created_at=p.created_at,
            seller_name=p.business.company_name if p.business else "Unknown seller",
            seller_city=p.business.city if p.business else None,
            seller_rating_avg=avg, seller_rating_count=count,
        ))
    return out


@router.get("/products/{product_id}", response_model=ProductPublicOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    p = db.query(Product).options(joinedload(Product.business)).filter(Product.id == product_id).first()
    if not p or not p.is_active:
        raise HTTPException(status_code=404, detail="Product not found")
    avg, count = _rating_summary(db, business_id=str(p.business_id))
    return ProductPublicOut(
        id=str(p.id), business_id=str(p.business_id), name=p.name, description=p.description,
        category=p.category, price=p.price, stock_quantity=p.stock_quantity, unit_weight_kg=p.unit_weight_kg,
        image_url=p.image_url, is_active=p.is_active, created_at=p.created_at,
        seller_name=p.business.company_name if p.business else "Unknown seller",
        seller_city=p.business.city if p.business else None,
        seller_rating_avg=avg, seller_rating_count=count,
    )


@router.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(Product.category).filter(Product.is_active.is_(True), Product.category.isnot(None)).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


@router.get("/orders/{tracking_number}", response_model=MarketplaceOrderOut)
def get_marketplace_order(tracking_number: str, db: Session = Depends(get_db)):
    """
    Public lookup by AWB - same trust model as /tracking/{awb}: a tracking
    number is already shared with people who may have no account (guest
    buyers included), so no auth is required to look up its own order.
    """
    order = (
        db.query(Order)
        .options(joinedload(Order.product).joinedload(Product.business), joinedload(Order.dropoff_address))
        .filter(Order.tracking_number == tracking_number.strip().upper())
        .first()
    )
    if not order or not order.product_id:
        raise HTTPException(status_code=404, detail="Marketplace order not found")

    delivery_fee = round((order.estimated_price or 0.0), 2)
    goods_amount = round((order.unit_price or 0.0) * (order.quantity or 1), 2)
    return MarketplaceOrderOut(
        id=str(order.id),
        tracking_number=order.tracking_number,
        status=order.status.value if hasattr(order.status, "value") else order.status,
        product_id=str(order.product_id),
        product_name=order.product.name if order.product else "",
        quantity=order.quantity or 1,
        unit_price=order.unit_price or 0.0,
        goods_amount=goods_amount,
        delivery_fee=delivery_fee,
        discount_amount=order.discount_amount,
        final_price=order.final_price,
        seller_name=order.product.business.company_name if order.product and order.product.business else "Unknown seller",
        dropoff_full_address=order.dropoff_address.full_address if order.dropoff_address else "",
        created_at=order.created_at,
    )


@router.post("/checkout", response_model=MarketplaceOrderOut, status_code=201)
def checkout(
    payload: MarketplaceCheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Buy a product directly - works signed-in (and discount-eligible) or as a guest (name + phone, no discount)."""
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    order = create_marketplace_order(
        db=db,
        product=product,
        quantity=payload.quantity,
        dropoff=payload.dropoff_address,
        payment_method=PaymentMethod(payload.payment_method),
        current_user=current_user,
        guest_full_name=payload.guest_full_name,
        guest_phone=payload.guest_phone,
        guest_email=payload.guest_email,
        discount_code=payload.discount_code,
    )

    delivery_fee = round((order.estimated_price or 0.0), 2)
    goods_amount = round((order.unit_price or 0.0) * (order.quantity or 1), 2)
    return MarketplaceOrderOut(
        id=str(order.id),
        tracking_number=order.tracking_number,
        status=order.status.value if hasattr(order.status, "value") else order.status,
        product_id=str(product.id),
        product_name=product.name,
        quantity=order.quantity or 1,
        unit_price=order.unit_price or 0.0,
        goods_amount=goods_amount,
        delivery_fee=delivery_fee,
        discount_amount=order.discount_amount,
        final_price=order.final_price,
        seller_name=product.business.company_name if product.business else "Unknown seller",
        dropoff_full_address=order.dropoff_address.full_address if order.dropoff_address else payload.dropoff_address.full_address,
        created_at=order.created_at,
    )


@router.post("/ratings", response_model=RatingOut, status_code=201)
def rate_order(
    payload: RatingIn,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    order = (
        db.query(Order)
        .options(joinedload(Order.product), joinedload(Order.customer))
        .filter(Order.id == payload.order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    rating = submit_rating(
        db, order=order, score=payload.score, comment=payload.comment,
        current_user=current_user, rater_phone=payload.rater_phone,
    )
    return RatingOut.model_validate(rating)


@router.get("/sellers/{business_id}/ratings", response_model=RatingSummaryOut)
def seller_ratings(business_id: str, db: Session = Depends(get_db)):
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Seller not found")
    avg, count = _rating_summary(db, business_id=business_id)
    rows = (
        db.query(Rating)
        .filter(Rating.target_type == "seller", Rating.target_business_id == business_id)
        .order_by(Rating.created_at.desc())
        .limit(50)
        .all()
    )
    return RatingSummaryOut(average=avg, count=count, ratings=[RatingOut.model_validate(r) for r in rows])


@router.get("/ratings/by-phone/{phone}", response_model=RatingSummaryOut)
def customer_ratings_by_phone(phone: str, db: Session = Depends(get_db)):
    """
    Lets a seller check a buyer's reliability (e.g. COD no-show history)
    before accepting an order, even when that buyer never made an account -
    ratings for guest customers are keyed by phone, not by user id.
    """
    avg, count = _rating_summary(db, phone=phone)
    rows = (
        db.query(Rating)
        .filter(Rating.target_type == "customer", Rating.target_phone == phone)
        .order_by(Rating.created_at.desc())
        .limit(50)
        .all()
    )
    return RatingSummaryOut(average=avg, count=count, ratings=[RatingOut.model_validate(r) for r in rows])
