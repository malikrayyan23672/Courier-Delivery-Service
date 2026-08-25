from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.order import Order, OrderStatus, CreatedByType, BookingChannel
from app.models.payment import PaymentMethod
from app.models.local_branch import LocalBranch
from app.models.branch import Branch
from app.models.invoice import Invoice
from app.schemas.order import StaffOrderCreateRequest, OrderOut
from app.services.order_service import create_order, get_or_create_guest_customer, apply_scan_action
from app.services.receipt_pdf_service import generate_booking_receipt_pdf
from app.services.invoice_pdf_service import generate_invoice_pdf
from app.services.label_pdf_service import generate_shipping_label_pdf

router = APIRouter(prefix="/local-office", tags=["Local Office"])

LOCAL_BRANCH_ROLES = ("local_office_manager", "admin", "super_admin")


def _resolve_local_branch(current_user: User, db: Session) -> LocalBranch:
    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.local_branch_id:
        raise HTTPException(status_code=400, detail="You must be assigned to a local office to book guest parcels")
    local_branch = db.query(LocalBranch).filter(LocalBranch.id == staff_profile.local_branch_id).first()
    if not local_branch:
        raise HTTPException(status_code=404, detail="Local office not found")
    return local_branch


@router.post("/orders", response_model=OrderOut)
def book_guest_order(
    payload: StaffOrderCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*LOCAL_BRANCH_ROLES)),
):
    """
    Local office counter books a parcel for a walk-in guest - identical to
    the staff walk-in flow (app/api/v1/staff.py::book_walk_in_order), plus
    stamping which local office booked it so the guest receipt can name it.
    """
    local_branch = _resolve_local_branch(current_user, db)

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
    order.local_branch_id = local_branch.id
    db.commit()
    db.refresh(order)
    return order


@router.post("/scan")
def local_office_scan(
    tracking_number: str,
    action: str = Query("in", pattern="^(in|out|arrive)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*LOCAL_BRANCH_ROLES)),
):
    """
    Local office counter scan: a walk-in parcel booked here is handed into the
    network. `in`     -> IN_HUB     (created/picked_up -> in_hub at the parent hub)
    `out`    -> IN_TRANSIT (out of the parent hub on the bus)
    `arrive` -> DEST_HUB   (arrived at the destination hub)
    The parcel is routed to the hub that owns this local office's branch.
    """
    local_branch = _resolve_local_branch(current_user, db)
    if not local_branch.branch_id:
        raise HTTPException(status_code=400, detail="This local office is not linked to a branch")
    branch = db.query(Branch).filter(Branch.id == local_branch.branch_id).first()
    if not branch or not branch.hub_id:
        raise HTTPException(status_code=400, detail="This local office's branch is not linked to a hub")
    hub_id = str(branch.hub_id)

    order = db.query(Order).filter(Order.tracking_number == tracking_number.strip().upper()).first()
    if not order:
        raise HTTPException(status_code=404, detail="No parcel found with that tracking number")

    apply_scan_action(
        db, order, action, actor=current_user, facility_label=f"local office {local_branch.name}", hub_id=hub_id
    )
    db.commit()
    db.refresh(order)
    return {
        "id": str(order.id),
        "tracking_number": order.tracking_number,
        "status": order.status.value if hasattr(order.status, "value") else order.status,
        "package_description": order.package_description,
        "dropoff_city": order.dropoff_address.city if order.dropoff_address else None,
        "updated_at": order.updated_at,
        "scan_action": action,
        "note": f"Scanned {action} at local office {local_branch.name}",
    }


@router.get("/orders/{order_id}/receipt.pdf")
def get_booking_receipt_pdf(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*LOCAL_BRANCH_ROLES)),
):
    local_branch = _resolve_local_branch(current_user, db)
    order = db.query(Order).filter(Order.id == order_id, Order.local_branch_id == local_branch.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    pdf_bytes = generate_booking_receipt_pdf(order, office_name=local_branch.name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={order.tracking_number}-receipt.pdf"},
    )


@router.get("/orders/{order_id}/invoice.pdf")
def get_local_branch_order_invoice_pdf(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*LOCAL_BRANCH_ROLES)),
):
    """The itemized billing invoice (distinct from the guest QR receipt
    above) for an order booked at this counter."""
    local_branch = _resolve_local_branch(current_user, db)
    order = db.query(Order).filter(Order.id == order_id, Order.local_branch_id == local_branch.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    invoice = db.query(Invoice).filter(Invoice.order_id == order.id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="No invoice exists for this order")

    pdf_bytes = generate_invoice_pdf(invoice, order)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={invoice.invoice_number}.pdf"},
    )


@router.get("/orders/{order_id}/label.pdf")
def get_local_branch_order_label_pdf(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*LOCAL_BRANCH_ROLES)),
):
    """Printable shipping label for sticking on the parcel booked at this counter."""
    local_branch = _resolve_local_branch(current_user, db)
    order = db.query(Order).filter(Order.id == order_id, Order.local_branch_id == local_branch.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    pdf_bytes = generate_shipping_label_pdf(order, location_name=local_branch.name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={order.tracking_number}-label.pdf"},
    )
