from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.order import Order, CreatedByType, BookingChannel
from app.models.payment import PaymentMethod
from app.models.local_office import LocalOffice
from app.schemas.order import StaffOrderCreateRequest, OrderOut
from app.services.order_service import create_order, get_or_create_guest_customer
from app.services.receipt_pdf_service import generate_booking_receipt_pdf

router = APIRouter(prefix="/local-office", tags=["Local Office"])

LOCAL_OFFICE_ROLES = ("local_office_manager", "admin", "super_admin")


def _resolve_local_office(current_user: User, db: Session) -> LocalOffice:
    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.local_office_id:
        raise HTTPException(status_code=400, detail="You must be assigned to a local office to book guest parcels")
    office = db.query(LocalOffice).filter(LocalOffice.id == staff_profile.local_office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Local office not found")
    return office


@router.post("/orders", response_model=OrderOut)
def book_guest_order(
    payload: StaffOrderCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*LOCAL_OFFICE_ROLES)),
):
    """
    Local office counter books a parcel for a walk-in guest - identical to
    the staff walk-in flow (app/api/v1/staff.py::book_walk_in_order), plus
    stamping which local office booked it so the guest receipt can name it.
    """
    office = _resolve_local_office(current_user, db)

    if payload.customer_id:
        customer = db.query(User).filter(User.id == payload.customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
    else:
        if not payload.guest_full_name or not payload.guest_phone:
            raise HTTPException(
                status_code=400,
                detail="Provide either customer_id or guest_full_name + guest_phone",
            )
        customer = get_or_create_guest_customer(
            db, full_name=payload.guest_full_name, phone=payload.guest_phone, email=payload.guest_email
        )

    order = create_order(
        db=db,
        customer_id=customer.id,
        created_by_id=current_user.id,
        created_by_type=CreatedByType.staff,
        booking_channel=BookingChannel.walk_in,
        pickup=payload.pickup_address,
        dropoff=payload.dropoff_address,
        package_weight_kg=payload.package_weight_kg,
        package_description=payload.package_description,
        payment_method=PaymentMethod(payload.payment_method),
        collected_by_staff_id=current_user.id if payload.payment_method == "cash" else None,
    )
    order.local_office_id = office.id
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders/{order_id}/receipt.pdf")
def get_booking_receipt_pdf(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*LOCAL_OFFICE_ROLES)),
):
    office = _resolve_local_office(current_user, db)
    order = db.query(Order).filter(Order.id == order_id, Order.local_office_id == office.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    pdf_bytes = generate_booking_receipt_pdf(order, office_name=office.name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={order.tracking_number}-receipt.pdf"},
    )
