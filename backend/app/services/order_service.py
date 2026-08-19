import math
import secrets

from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.address import Address
from app.models.order import Order, CreatedByType, BookingChannel, OrderStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.invoice import Invoice
from app.models.rider import RiderProfile, RiderStatus
from app.models.tracking_event import TrackingEvent
from app.models.staff import StaffProfile
from app.models.branch import Branch
from app.models.bus_network import BusManifest, ManifestItem, ManifestStatus, ScanStatus
from app.models.system_setting import SystemSetting
from app.models.zone import Zone
from app.models.discount import Discount
from app.models.user import User
from app.models.role import Role
from app.core.security import hash_password
from app.services.pricing_service import estimate_price
from app.schemas.order import AddressInput
from app.services import log_service
from app.services import notification_service


# The 8-state parcel journey (+ `assigned`/`cancelled`, see OrderStatus docstring).
# Every edge a route handler is allowed to take - anything not listed here is
# rejected as a security incident (TRD: "no state can be skipped").
ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.created: {OrderStatus.assigned, OrderStatus.cancelled},
    OrderStatus.assigned: {OrderStatus.created, OrderStatus.picked_up, OrderStatus.cancelled},
    # Two legitimate paths from here: `in_hub` for a parcel entering the
    # inter-city bus network, or straight to `out_for_delivery` when the same
    # rider who picked it up also does the last mile (local, single-city
    # delivery - this app's original flow, kept alongside the new hub network).
    OrderStatus.picked_up: {OrderStatus.in_hub, OrderStatus.out_for_delivery, OrderStatus.cancelled},
    OrderStatus.in_hub: {OrderStatus.in_transit, OrderStatus.cancelled},
    OrderStatus.in_transit: {OrderStatus.dest_hub},
    OrderStatus.dest_hub: {OrderStatus.out_for_delivery},
    OrderStatus.out_for_delivery: {OrderStatus.delivered, OrderStatus.failed},
    OrderStatus.failed: {OrderStatus.out_for_delivery, OrderStatus.rto},
    OrderStatus.delivered: set(),
    OrderStatus.rto: set(),
    OrderStatus.cancelled: set(),
}


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def transition(
    db: Session,
    order: Order,
    new_status: OrderStatus,
    actor: User | None = None,
    note: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    reference_address: Address | None = None,
    geofence_meters: float = 500.0,
) -> Order:
    """
    The single place `order.status` is allowed to change. Validates the edge
    against ALLOWED_TRANSITIONS, writes a TrackingEvent (the immutable scan
    log), and optionally checks the scan GPS against a reference address
    (e.g. the seller's pickup address) - a mismatch is logged as a note on
    the event rather than hard-blocked, since address geocoding isn't always
    populated, but it's never silently dropped.
    """
    current = order.status if isinstance(order.status, OrderStatus) else OrderStatus(order.status)
    allowed = ALLOWED_TRANSITIONS.get(current, set())

    if new_status != current and new_status not in allowed:
        log_service.create_log(
            db,
            action="invalid_state_transition",
            user_id=str(actor.id) if actor else None,
            entity_type="Order",
            entity_id=str(order.id),
            details=f"Rejected {current.value} -> {new_status.value}",
        )
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move an order from '{current.value}' to '{new_status.value}' - that state cannot be skipped.",
        )

    geofence_note = None
    if lat is not None and lng is not None and reference_address and reference_address.lat and reference_address.lng:
        distance = haversine_meters(lat, lng, reference_address.lat, reference_address.lng)
        if distance > geofence_meters:
            geofence_note = f"GPS {round(distance)}m from expected address (limit {round(geofence_meters)}m)"

    order.status = new_status
    combined_note = " | ".join(n for n in (note, geofence_note) if n)
    db.add(
        TrackingEvent(
            order_id=order.id,
            status=new_status.value,
            note=combined_note or None,
            lat=lat,
            lng=lng,
            changed_by_id=actor.id if actor else None,
        )
    )
    return order


def create_order(
    db: Session,
    customer_id: str,
    created_by_id: str,
    created_by_type: CreatedByType,
    booking_channel: BookingChannel,
    pickup: AddressInput,
    dropoff: AddressInput,
    package_weight_kg: float | None,
    # package_size: str | None,
    package_description: str | None,
    payment_method: PaymentMethod = PaymentMethod.online_gateway,
    collected_by_staff_id: str | None = None,
    discount_code: str | None = None,
    allow_discount: bool = True,
    product_id: str | None = None,
    quantity: int | None = None,
    unit_price: float | None = None,
    seller_business_id: str | None = None,
) -> Order:
    pickup_address = Address(**pickup.model_dump())
    dropoff_address = Address(**dropoff.model_dump())
    db.add_all([pickup_address, dropoff_address])
    db.flush()  # get IDs without committing yet

    price = estimate_price(pickup_address, dropoff_address, package_weight_kg, db)
    goods_amount = round(unit_price * quantity, 2) if unit_price is not None and quantity is not None else 0.0

    # Determine zone and branch
    zone_id = None
    branch_id = None

    if created_by_type == CreatedByType.staff:
        staff_profile = db.query(StaffProfile).filter(StaffProfile.user_id == created_by_id).first()
        if staff_profile and staff_profile.branch_id:
            branch_id = staff_profile.branch_id
            if staff_profile.branch:
                zone_id = staff_profile.branch.zone_id
    elif created_by_type == CreatedByType.customer:
        if pickup.city:
            zone = db.query(Zone).filter(func.lower(Zone.name) == func.lower(pickup.city.strip())).first()
            if zone:
                zone_id = zone.id
                branch = db.query(Branch).filter(Branch.zone_id == zone.id, Branch.status == "active").first()
                if branch:
                    branch_id = branch.id

    # Discount is computed against the delivery fee only, before goods are
    # added in - a guest checkout (allow_discount=False) never reaches
    # `_apply_discount` at all, so an anonymous buyer can't claim it.
    discount_id, discount_amount = (
        _apply_discount(db, customer_id=customer_id, price=price, code=discount_code)
        if allow_discount
        else (None, None)
    )

    order = Order(
        customer_id=customer_id,
        created_by_id=created_by_id,
        created_by_type=created_by_type,
        booking_channel=booking_channel,
        pickup_address_id=pickup_address.id,
        dropoff_address_id=dropoff_address.id,
        package_weight_kg=package_weight_kg,
        # package_size=package_size,
        package_description=package_description,
        estimated_price=price,
        discount_id=discount_id,
        discount_amount=discount_amount,
        final_price=round(price - (discount_amount or 0.0) + goods_amount, 2),
        zone_id=zone_id,
        branch_id=branch_id,
        product_id=product_id,
        quantity=quantity,
        unit_price=unit_price,
        seller_business_id=seller_business_id,
    )
    db.add(order)
    db.flush()

    payment = Payment(
        order_id=order.id,
        amount=order.final_price or price,
        method=payment_method,
        status=PaymentStatus.paid if payment_method == PaymentMethod.cash else PaymentStatus.pending,
        collected_by_staff_id=collected_by_staff_id,
    )
    db.add(payment)

    invoice = Invoice(
        order_id=order.id,
        invoice_number=f"INV-{order.tracking_number}",
        subtotal=price,
        discount_amount=discount_amount,
        tax_amount=0.0,
        total_amount=order.final_price if order.final_price is not None else price,
        status="paid" if payment.status == PaymentStatus.paid else "unpaid",
    )
    db.add(invoice)

    # A real customer email/SMS confirmation would trigger here via
    # notification_tasks.send_order_confirmation.delay(...) once Twilio/SendGrid
    # credentials exist (currently empty-string placeholders in app/config.py) -
    # not wired yet since there's no Celery worker running in this environment
    # to consume it, and an unconsumed .delay() would silently no-op forever.

    db.commit()
    db.refresh(order)

    if _network_auto_assign_enabled(db):
        _auto_assign_rider(db, order)
    db.commit()
    db.refresh(order)
    return order


def _network_auto_assign_enabled(db: Session) -> bool:
    """Reads the superadmin Network Defaults toggle (admin_network.py's
    /admin/network/settings). Defaults to True (the prior always-on
    behavior) when the setting has never been saved."""
    row = db.query(SystemSetting).filter(SystemSetting.key == "auto_assign_enabled").first()
    return row.value != "false" if row else True


def get_or_create_guest_customer(db: Session, full_name: str, phone: str, email: str | None = None) -> User:
    """
    Same "lightweight customer record" pattern the staff walk-in booking flow
    uses (see staff.book_walk_in_order) - a guest gets a real `User` row keyed
    by phone, with a random unusable password, so the whole downstream order
    pipeline (state machine, tracking, ratings) works unmodified. If that
    phone has already ordered as a guest (or has a real account), reuse it
    rather than erroring on the unique-phone constraint.
    """
    existing = db.query(User).filter(User.phone == phone).first()
    if existing:
        return existing

    customer_role = db.query(Role).filter(Role.name == "customer").first()
    guest = User(
        full_name=full_name,
        phone=phone,
        email=email or f"guest_{phone}@placeholder.local",
        hashed_password=hash_password(secrets.token_urlsafe(16)),
        role_id=customer_role.id,
        is_verified=False,
    )
    db.add(guest)
    db.flush()
    return guest


def _apply_discount(
    db: Session,
    customer_id: str,
    price: float,
    code: str | None,
) -> tuple[str | None, float | None]:
    """
    Layer 6 - login-only discounts. Always resolves against the authenticated
    customer (this helper is only reachable from the authenticated order flow),
    so an anonymous visitor can never claim the discount.
    """
    discount = None

    if code:
        discount = db.query(Discount).filter(func.lower(Discount.code) == code.strip().lower()).first()
        if not discount:
            raise HTTPException(
                status_code=400,
                detail="Invalid discount code",
            )
    else:
        # No code: auto-apply a seeded 'first shipment' discount, but only for
        # a customer who has never placed an order yet (signup bonus).
        has_orders = db.query(Order).filter(Order.customer_id == customer_id).first() is not None
        if not has_orders:
            discount = (
                db.query(Discount)
                .filter(Discount.is_auto_applied.is_(True), Discount.is_active.is_(True))
                .first()
            )

    if not discount:
        return None, None

    if discount.requires_login:
        # Already guaranteed - customer is authenticated in this flow.
        pass

    if not discount.is_redeemable():
        raise HTTPException(status_code=400, detail="This discount is no longer available")

    if discount.min_order_value and price < discount.min_order_value:
        raise HTTPException(
            status_code=400,
            detail=f"Order value must be at least {discount.min_order_value} to use this discount",
        )

    discount.uses_count = (discount.uses_count or 0) + 1
    db.flush()

    return str(discount.id), round(discount.apply(price), 2)


def offer_last_mile_rider(
    db: Session,
    order: Order,
    rider: RiderProfile,
    actor: User | None = None,
    note: str | None = None,
) -> None:
    """Puts a rider up for the destination-hub last-mile leg. Doesn't move
    `order.status` (it's already `dest_hub`, which doubles as the "offer
    pending" state) - the rider accepts/declines via respond_to_offer, same
    shape as the origin pickup offer."""
    order.rider_id = rider.id
    order.rider_accepted = None
    transition(db, order, order.status, actor=actor, note=note or f"Offered to rider {rider.user.full_name if rider.user else rider.id}")
    notification_service.notify(
        db,
        user_id=rider.user_id,
        title="New delivery offer",
        message=f"Order {order.tracking_number} assigned to you for last-mile delivery",
        order_id=order.id,
    )


def auto_assign_last_mile_rider(db: Session, order: Order, actor: User | None = None) -> RiderProfile | None:
    """Picks the best available rider at the order's (destination) branch,
    same ranking as `_auto_assign_rider` but scoped by branch rather than
    zone, since the last mile is a single-branch hand-off."""
    if not order.branch_id:
        return None

    query = db.query(RiderProfile).filter(
        RiderProfile.branch_id == order.branch_id,
        RiderProfile.status == RiderStatus.active,
        RiderProfile.is_available.is_(True),
    )
    if order.payment and order.payment.method == PaymentMethod.cash:
        query = query.filter(RiderProfile.cod_wallet_locked.is_(False))

    rider = query.order_by(RiderProfile.rating.desc(), RiderProfile.created_at.asc()).first()
    if not rider:
        return None

    offer_last_mile_rider(db, order, rider, actor=actor, note=f"Auto-assigned to rider {rider.user.full_name} for last-mile delivery")
    return rider


def maybe_auto_assign_last_mile_rider(db: Session, order: Order, actor: User | None = None) -> RiderProfile | None:
    """Only auto-assigns if the order's branch has last-mile assignment set
    to automatic - the manual branches leave the order in the last-mile
    queue for hub staff to pick a rider themselves."""
    if not order.branch_id:
        return None
    branch = db.query(Branch).filter(Branch.id == order.branch_id).first()
    if not branch or branch.rider_assignment_mode != "automatic":
        return None
    return auto_assign_last_mile_rider(db, order, actor=actor)


def handle_dest_hub_arrival(db: Session, order: Order, branch_id: str, actor: User | None = None) -> None:
    """Called the moment a parcel reaches `dest_hub`. Records the branch now
    physically holding it (order.branch_id tracked the origin branch up to
    this point) so the hub console's queries - which all scope by
    Order.branch_id - pick it up, then offers a last-mile rider if that
    branch runs automatic assignment."""
    order.branch_id = branch_id
    maybe_auto_assign_last_mile_rider(db, order, actor=actor)


# Cancellation is only a legal edge up through `picked_up` (see
# ALLOWED_TRANSITIONS) - once a parcel is scanned into a hub it's physically
# committed to the bus network, so "cancelled" has no `in_hub`-onward edge
# and a failed/RTO parcel is handled through the return flow instead.
CANCELLABLE_STATUSES = {OrderStatus.created, OrderStatus.assigned, OrderStatus.picked_up}


def cancel_order(db: Session, order: Order, actor: User | None = None, reason: str | None = None) -> Order:
    """Cancels an order on behalf of whoever booked it (customer or seller).
    Notifies the assigned rider, if any, so they don't show up for a pickup
    that's off."""
    current = order.status if isinstance(order.status, OrderStatus) else OrderStatus(order.status)
    if current not in CANCELLABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"An order can only be cancelled before it enters the hub network - currently '{current.value}'.",
        )

    rider_id = order.rider_id
    transition(db, order, OrderStatus.cancelled, actor=actor, note=f"Cancelled{f' - {reason}' if reason else ''}")

    if rider_id:
        rider = db.query(RiderProfile).filter(RiderProfile.id == rider_id).first()
        if rider:
            notification_service.notify(
                db, user_id=rider.user_id, title="Delivery cancelled",
                message=f"Order {order.tracking_number} was cancelled - no pickup/delivery needed.",
                type="warning", order_id=order.id,
            )
    return order


def _auto_assign_rider(db: Session, order: Order) -> RiderProfile | None:
    if not order.zone_id:
        return None

    query = (
        db.query(RiderProfile)
        .join(Branch, RiderProfile.branch_id == Branch.id)
        .filter(
            RiderProfile.status == RiderStatus.active,
            RiderProfile.is_available.is_(True),
            Branch.zone_id == order.zone_id,
        )
    )
    # A rider whose COD cash-in-hand wallet is locked can't take on new COD parcels.
    if order.payment and order.payment.method == PaymentMethod.cash:
        query = query.filter(RiderProfile.cod_wallet_locked.is_(False))

    rider = query.order_by(RiderProfile.rating.desc(), RiderProfile.created_at.asc()).first()
    if not rider:
        return None

    order.rider_id = rider.id
    order.rider_accepted = None
    transition(db, order, OrderStatus.assigned, note=f"Auto-assigned to rider {rider.user.full_name}")
    notification_service.notify(
        db,
        user_id=rider.user_id,
        title="New pickup offer",
        message=f"Order {order.tracking_number} assigned to you",
        order_id=order.id,
    )
    return rider


def _get_or_create_return_batch(db: Session, branch_id: str) -> BusManifest:
    """The open (in_preparation) RTO return batch for this branch, or a new
    one - RTO manifests are marked by an "RTO-" manifest number instead of
    the "MF-" forward-dispatch ones so this lookup doesn't need a join."""
    manifest = (
        db.query(BusManifest)
        .filter(
            BusManifest.origin_branch_id == branch_id,
            BusManifest.status == ManifestStatus.in_preparation,
            BusManifest.manifest_number.like("RTO-%"),
        )
        .order_by(BusManifest.created_at.desc())
        .first()
    )
    if manifest:
        return manifest

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    manifest = BusManifest(
        origin_branch_id=branch_id,
        manifest_number=f"RTO-{secrets.token_hex(3).upper()}",
        status=ManifestStatus.in_preparation,
        origin_city=branch.name if branch else None,
        destination_city="Return to seller",
    )
    db.add(manifest)
    db.flush()
    return manifest


def add_order_to_return_batch(db: Session, order: Order) -> None:
    """Groups a physically-returned RTO parcel into this branch's open
    return batch (TRD: "Return batch auto-created") - same crate-on-a-
    manifest model as forward dispatch, just auto-built instead of hand-
    assembled by staff. Called once the rider has actually handed the
    parcel back at the hub (see rider.py's return_to_hub), matching how the
    forward flow only loads a parcel onto a manifest once it's physically
    at the hub."""
    if not order.branch_id:
        return

    already_batched = (
        db.query(ManifestItem)
        .join(BusManifest, ManifestItem.manifest_id == BusManifest.id)
        .filter(ManifestItem.order_id == order.id, BusManifest.manifest_number.like("RTO-%"))
        .first()
    )
    if already_batched:
        return

    manifest = _get_or_create_return_batch(db, order.branch_id)
    db.add(
        ManifestItem(
            manifest_id=manifest.id,
            order_id=order.id,
            crate_label=f"RTO-{order.tracking_number}",
            scan_status=ScanStatus.loaded,
        )
    )
