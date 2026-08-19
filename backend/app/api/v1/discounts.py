from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.discount import Discount, DiscountType
from app.schemas.discount import DiscountIn, DiscountOut, DiscountPublicOut

router = APIRouter(prefix="/discounts", tags=["Discounts"])


@router.get("/public", response_model=list[DiscountPublicOut])
def public_discounts(db: Session = Depends(get_db)):
    """
    Public marketing list. The discount itself is only redeemable at booking
    time by a signed-in customer (see customer order flow), so the landing page
    can advertise it while an anonymous visitor cannot actually use it.
    """
    rows = db.query(Discount).filter(Discount.is_active.is_(True)).all()
    return [
        DiscountPublicOut(
            id=str(d.id),
            title=d.title,
            description=d.description,
            discount_type=d.discount_type.value if hasattr(d.discount_type, "value") else d.discount_type,
            value=d.value,
            max_discount_amount=d.max_discount_amount,
            min_order_value=d.min_order_value,
            expires_at=d.expires_at,
        )
        for d in rows
    ]


@router.get("", response_model=list[DiscountOut])
def list_discounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    return [DiscountOut.model_validate(d) for d in db.query(Discount).order_by(Discount.created_at.desc()).all()]


@router.post("", response_model=DiscountOut, status_code=201)
def create_discount(
    payload: DiscountIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    if payload.code:
        existing = db.query(Discount).filter(Discount.code == payload.code).first()
        if existing:
            raise HTTPException(status_code=400, detail="Discount code already exists")

    discount = Discount(
        code=payload.code,
        title=payload.title,
        description=payload.description,
        discount_type=DiscountType(payload.discount_type),
        value=payload.value,
        max_discount_amount=payload.max_discount_amount,
        min_order_value=payload.min_order_value,
        requires_login=payload.requires_login,
        is_auto_applied=payload.is_auto_applied,
        max_uses=payload.max_uses,
        is_active=payload.is_active,
        expires_at=payload.expires_at,
    )
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return DiscountOut.model_validate(discount)


@router.patch("/{discount_id}/toggle", response_model=DiscountOut)
def toggle_discount(
    discount_id: str,
    is_active: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    discount = db.query(Discount).filter(Discount.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    discount.is_active = is_active
    db.commit()
    db.refresh(discount)
    return DiscountOut.model_validate(discount)


@router.delete("/{discount_id}", status_code=204)
def delete_discount(
    discount_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Only safe to hard-delete a discount nobody has ever redeemed - once
    `uses_count` is nonzero, orders reference it (Order.discount_id), so
    pause it (toggle inactive) instead."""
    discount = db.query(Discount).filter(Discount.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    if discount.uses_count:
        raise HTTPException(
            status_code=400,
            detail="This discount has been used by orders and can't be deleted - pause it instead.",
        )
    db.delete(discount)
    db.commit()