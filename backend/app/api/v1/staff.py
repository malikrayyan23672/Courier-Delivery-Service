from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.order import CreatedByType, BookingChannel
from app.models.payment import PaymentMethod
from app.models.invoice import Invoice
from app.schemas.order import StaffOrderCreateRequest, OrderOut
from app.services.order_service import create_order, get_or_create_guest_customer, transition
from app.services import notification_service
from app.services.invoice_pdf_service import generate_invoice_pdf
from app.services.label_pdf_service import generate_shipping_label_pdf

router = APIRouter(prefix="/staff", tags=["Staff Panel"])


@router.post("/orders", response_model=OrderOut)
def book_walk_in_order(
    payload: StaffOrderCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    """
    Staff books a courier on behalf of a walk-in customer.
    - If customer_id is provided, link to that existing account.
    - Otherwise, create a lightweight guest customer record from the
      contact details given at the counter.
    """
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
        created_by_id=current_user.id,          # audit: which staff member booked this
        created_by_type=CreatedByType.staff,
        booking_channel=BookingChannel.walk_in,
        pickup=payload.pickup_address,
        dropoff=payload.dropoff_address,
        package_weight_kg=payload.package_weight_kg,
        # package_size=payload.package_size,
        package_description=payload.package_description,
        payment_method=PaymentMethod(payload.payment_method),
        collected_by_staff_id=current_user.id if payload.payment_method == "cash" else None,
    )
    return order


from app.models.staff import StaffProfile
from datetime import datetime, timezone

from app.models.rider import RiderProfile, RiderStatus
from app.models.order import Order, OrderStatus
from app.models.tracking_event import TrackingEvent
from app.models.branch import Branch
from app.models.rider_status_request import RiderStatusRequest, RequestStatus
from app.models.parcel_unlock_request import ParcelUnlockRequest
from app.models.support_ticket import SupportTicket, SupportTicketMessage, SupportTicketStatus
from app.schemas.rider import (
    ResolveRequestPayload,
    RiderStatusRequestOut,
    ParcelUnlockRequestOut,
    SupportTicketOut,
    SupportTicketMessageOut,
    SupportTicketMessageCreate,
    SupportTicketStatusUpdate,
    RiderLocationOut,
)
from app.services.settlement_service import rider_wallet_limit, rider_wallet_warning_at


@router.get("/orders", response_model=list[OrderOut])
def list_branch_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.branch_id:
        raise HTTPException(status_code=400, detail="You must belong to a branch to list branch orders")
    
    return db.query(Order).filter(Order.branch_id == staff_profile.branch_id).order_by(Order.created_at.desc()).all()


@router.get("/orders/{order_id}/invoice.pdf")
def get_order_invoice_pdf(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.branch_id:
        raise HTTPException(status_code=400, detail="You must belong to a branch to view order invoices")

    order = db.query(Order).filter(Order.id == order_id, Order.branch_id == staff_profile.branch_id).first()
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
def get_order_label_pdf(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    """Printable shipping label for sticking on the parcel - same branch
    scope as the invoice above, so hub/branch staff can (re)print it for any
    order booked at or currently sitting in their own branch."""
    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.branch_id:
        raise HTTPException(status_code=400, detail="You must belong to a branch to view parcel labels")

    order = db.query(Order).filter(Order.id == order_id, Order.branch_id == staff_profile.branch_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    pdf_bytes = generate_shipping_label_pdf(order, location_name=staff_profile.branch.name if staff_profile.branch else None)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={order.tracking_number}-label.pdf"},
    )


@router.get("/riders")
def list_branch_zone_riders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.branch_id or not staff_profile.branch:
        raise HTTPException(status_code=400, detail="You must belong to a branch to list active riders")
    
    zone_id = staff_profile.branch.zone_id
    if not zone_id:
        raise HTTPException(status_code=400, detail="Your branch must belong to a zone to list active riders")

    riders = (
        db.query(RiderProfile)
        .join(Branch, RiderProfile.branch_id == Branch.id)
        .filter(RiderProfile.status == RiderStatus.active, Branch.zone_id == zone_id)
        .all()
    )

    return [
        {
            "rider_id": str(r.id),
            "full_name": r.user.full_name,
            "phone": r.user.phone,
            "vehicle_type": r.vehicle_type,
            "is_available": r.is_available,
            "rating": r.rating,
            "cod_cash_held": round(r.cod_cash_held or 0.0, 2),
            "cod_wallet_locked": r.cod_wallet_locked or False,
            "wallet_limit": rider_wallet_limit(r),
            "wallet_warning_at": rider_wallet_warning_at(r),
        }
        for r in riders
    ]


@router.get("/riders/locations", response_model=list[RiderLocationOut])
def list_branch_zone_rider_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    """Live rider positions for the staff Live Map - scoped to the staff
    member's own branch zone, mirroring list_branch_zone_riders above."""
    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.branch_id or not staff_profile.branch:
        raise HTTPException(status_code=400, detail="You must belong to a branch to view rider locations")

    zone_id = staff_profile.branch.zone_id
    if not zone_id:
        raise HTTPException(status_code=400, detail="Your branch must belong to a zone to view rider locations")

    riders = (
        db.query(RiderProfile)
        .join(Branch, RiderProfile.branch_id == Branch.id)
        .filter(
            RiderProfile.status == RiderStatus.active,
            Branch.zone_id == zone_id,
            RiderProfile.current_lat.isnot(None),
            RiderProfile.current_lng.isnot(None),
        )
        .all()
    )

    return [
        RiderLocationOut(
            rider_id=str(r.id),
            full_name=r.user.full_name,
            lat=r.current_lat,
            lng=r.current_lng,
            is_available=r.is_available or False,
            vehicle_type=r.vehicle_type,
            rating=r.rating,
        )
        for r in riders
    ]


@router.patch("/orders/{order_id}/assign-rider/{rider_id}")
def staff_assign_rider(
    order_id: str,
    rider_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    staff_profile = current_user.staff_profile
    if not staff_profile or not staff_profile.branch_id or not staff_profile.branch:
        raise HTTPException(status_code=400, detail="You must belong to a branch to assign riders")
    
    zone_id = staff_profile.branch.zone_id
    if not zone_id:
        raise HTTPException(status_code=400, detail="Your branch must belong to a zone to assign riders")

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify order is in the staff member's branch's zone
    if order.zone_id != zone_id:
        raise HTTPException(status_code=403, detail="You can only assign riders to orders inside your branch's zone")

    rider = (
        db.query(RiderProfile)
        .join(Branch, RiderProfile.branch_id == Branch.id)
        .filter(
            RiderProfile.id == rider_id,
            RiderProfile.status == RiderStatus.active,
            Branch.zone_id == zone_id
        )
        .first()
    )
    if not rider:
        raise HTTPException(status_code=404, detail="Active rider not found in your branch's zone")
    if rider.cod_wallet_locked and order.payment and order.payment.method.value == "cash":
        raise HTTPException(status_code=400, detail="This rider's COD wallet is locked and cannot accept new COD parcels")

    order.rider_id = rider.id
    order.rider_accepted = None
    transition(
        db,
        order,
        OrderStatus.assigned,
        actor=current_user,
        note=f"Manually assigned by staff {current_user.full_name} at branch {staff_profile.branch.name}",
    )
    notification_service.notify(
        db,
        user_id=rider.user_id,
        title="New pickup offer",
        message=f"Order {order.tracking_number} assigned to you",
        order_id=order.id,
    )
    db.commit()

    return {"message": "Rider assigned successfully"}


@router.get("/availability-requests", response_model=list[RiderStatusRequestOut])
def list_availability_requests(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    query = db.query(RiderStatusRequest)
    if status == "all":
        pass
    elif status:
        query = query.filter(RiderStatusRequest.status == status)
    else:
        query = query.filter(RiderStatusRequest.status == RequestStatus.pending)

    requests = query.order_by(RiderStatusRequest.created_at.asc()).all()
    return [
        RiderStatusRequestOut(
            id=r.id,
            rider_id=r.rider_id,
            rider_name=r.rider.user.full_name if r.rider and r.rider.user else None,
            requested_by_id=r.requested_by_id,
            requested_is_available=r.requested_is_available,
            note=r.note,
            status=r.status.value if hasattr(r.status, "value") else r.status,
            resolution_note=r.resolution_note,
            resolved_at=r.resolved_at,
            created_at=r.created_at,
        )
        for r in requests
    ]


@router.patch("/availability-requests/{request_id}/resolve", response_model=RiderStatusRequestOut)
def resolve_availability_request(
    request_id: str,
    payload: ResolveRequestPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    request = db.query(RiderStatusRequest).filter(RiderStatusRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Availability request not found")
    if request.status != RequestStatus.pending:
        raise HTTPException(status_code=400, detail="This request has already been resolved")

    request.status = RequestStatus.approved if payload.approve else RequestStatus.rejected
    request.resolution_note = payload.resolution_note
    request.resolved_by_id = current_user.id
    request.resolved_at = datetime.now(timezone.utc)

    if payload.approve:
        rider_profile = request.rider
        if rider_profile.status == RiderStatus.pending_verification and request.requested_is_available:
            rider_profile.status = RiderStatus.active
        rider_profile.is_available = request.requested_is_available

    db.commit()
    db.refresh(request)
    return RiderStatusRequestOut(
        id=request.id,
        rider_id=request.rider_id,
        rider_name=request.rider.user.full_name if request.rider and request.rider.user else None,
        requested_by_id=request.requested_by_id,
        requested_is_available=request.requested_is_available,
        note=request.note,
        status=request.status.value if hasattr(request.status, "value") else request.status,
        resolution_note=request.resolution_note,
        resolved_at=request.resolved_at,
        created_at=request.created_at,
    )


@router.get("/unlock-requests", response_model=list[ParcelUnlockRequestOut])
def list_unlock_requests(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    query = db.query(ParcelUnlockRequest)
    if status == "all":
        pass
    elif status:
        query = query.filter(ParcelUnlockRequest.status == status)
    else:
        query = query.filter(ParcelUnlockRequest.status == RequestStatus.pending)

    requests = query.order_by(ParcelUnlockRequest.created_at.asc()).all()
    return [
        ParcelUnlockRequestOut(
            id=r.id,
            order_id=r.order_id,
            tracking_number=r.order.tracking_number if r.order else None,
            rider_id=r.rider_id,
            rider_name=r.rider.user.full_name if r.rider and r.rider.user else None,
            requested_by_id=r.requested_by_id,
            reason=r.reason,
            status=r.status.value if hasattr(r.status, "value") else r.status,
            resolution_note=r.resolution_note,
            resolved_at=r.resolved_at,
            created_at=r.created_at,
        )
        for r in requests
    ]


@router.patch("/unlock-requests/{request_id}/resolve", response_model=ParcelUnlockRequestOut)
def resolve_unlock_request(
    request_id: str,
    payload: ResolveRequestPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    request = db.query(ParcelUnlockRequest).filter(ParcelUnlockRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Unlock request not found")
    if request.status != RequestStatus.pending:
        raise HTTPException(status_code=400, detail="This request has already been resolved")

    request.status = RequestStatus.approved if payload.approve else RequestStatus.rejected
    request.resolution_note = payload.resolution_note
    request.resolved_by_id = current_user.id
    request.resolved_at = datetime.now(timezone.utc)

    if payload.approve:
        order = request.order
        if order.status == OrderStatus.assigned and order.rider_id == request.rider_id:
            order.rider_id = None
            order.rider_accepted = None
            transition(db, order, OrderStatus.created, actor=current_user, note="Unlock request approved by staff")

    db.commit()
    db.refresh(request)
    return ParcelUnlockRequestOut(
        id=request.id,
        order_id=request.order_id,
        tracking_number=request.order.tracking_number if request.order else None,
        rider_id=request.rider_id,
        rider_name=request.rider.user.full_name if request.rider and request.rider.user else None,
        requested_by_id=request.requested_by_id,
        reason=request.reason,
        status=request.status.value if hasattr(request.status, "value") else request.status,
        resolution_note=request.resolution_note,
        resolved_at=request.resolved_at,
        created_at=request.created_at,
    )


# --- Support tickets (staff/admin/manager view of all riders' tickets) ---

def _support_ticket_out(ticket: SupportTicket) -> SupportTicketOut:
    return SupportTicketOut(
        id=ticket.id,
        raised_by_id=ticket.raised_by_id,
        raised_by_name=ticket.raised_by.full_name if ticket.raised_by else None,
        subject=ticket.subject,
        order_id=ticket.order_id,
        tracking_number=ticket.order.tracking_number if ticket.order else None,
        status=ticket.status.value if hasattr(ticket.status, "value") else ticket.status,
        resolved_at=ticket.resolved_at,
        created_at=ticket.created_at,
        messages=[
            SupportTicketMessageOut(
                id=m.id,
                sender_id=m.sender_id,
                sender_name=m.sender.full_name if m.sender else None,
                body=m.body,
                created_at=m.created_at,
            )
            for m in ticket.messages
        ],
    )


@router.get("/support-tickets", response_model=list[SupportTicketOut])
def list_support_tickets(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    query = db.query(SupportTicket)
    if status and status != "all":
        query = query.filter(SupportTicket.status == status)

    tickets = query.order_by(SupportTicket.created_at.desc()).all()
    return [_support_ticket_out(t) for t in tickets]


@router.get("/support-tickets/{ticket_id}", response_model=SupportTicketOut)
def support_ticket_detail(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")
    return _support_ticket_out(ticket)


@router.post("/support-tickets/{ticket_id}/messages", response_model=SupportTicketOut)
def reply_to_support_ticket(
    ticket_id: str,
    payload: SupportTicketMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")

    db.add(SupportTicketMessage(ticket_id=ticket.id, sender_id=current_user.id, body=payload.body.strip()))
    # A staff reply on a fresh ticket counts as picking it up. Resolved/closed
    # tickets are NOT auto-reopened by a reply - staff use the status endpoint
    # explicitly for that so a closing note doesn't accidentally reopen a ticket.
    if ticket.status == SupportTicketStatus.open:
        ticket.status = SupportTicketStatus.in_progress
    db.commit()
    db.refresh(ticket)
    return _support_ticket_out(ticket)


@router.patch("/support-tickets/{ticket_id}/status", response_model=SupportTicketOut)
def update_support_ticket_status(
    ticket_id: str,
    payload: SupportTicketStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin", "super_admin", "manager", "hub_manager")),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")

    new_status = SupportTicketStatus(payload.status)
    ticket.status = new_status
    ticket.resolved_at = datetime.now(timezone.utc) if new_status in (SupportTicketStatus.resolved, SupportTicketStatus.closed) else None
    db.commit()
    db.refresh(ticket)
    return _support_ticket_out(ticket)
