"""
Run after migrations:

    python seed.py

Seeds a complete demo data set for the FastAPI courier backend. The script is
idempotent, so it can be re-run safely while developing.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.database import SessionLocal
from app.models.activity_log import ActivityLog
from app.models.address import Address
from app.models.announcement import Announcement
from app.models.audit_log import AuditLog
from app.models.branch import Branch
from app.models.business import Business
from app.models.customer import Customer
from app.models.delivery_attempt import DeliveryAttempt
from app.models.invoice import Invoice
from app.models.live_tracking import LiveTracking
from app.models.notification import Notification
from app.models.order import BookingChannel, CreatedByType, Order, OrderStatus
from app.models.order_status_history import OrderStatusHistory
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.pricing_rule import PricingRule
from app.models.rider import RiderProfile, RiderStatus
from app.models.rider_assignment import RiderAssignment
from app.models.role import Role
from app.models.route import Route
from app.models.staff import StaffProfile
from app.models.status import Status
from app.models.system_setting import SystemSetting
from app.models.tracking_event import TrackingEvent
from app.models.user import User
from app.models.warehouse import Warehouse
from app.models.zone import Zone

PASSWORD = "Password123"

ROLES = [
    ("customer", "Books shipments and tracks orders"),
    ("staff", "Office/counter staff who book walk-in orders"),
    ("rider", "Delivery partner who fulfills orders"),
    ("admin", "Operations staff with broad management access"),
    ("super_admin", "Full system access including pricing and config"),
]

STATUSES = [
    ("created", "Order has been created"),
    ("assigned", "Order has been assigned to a rider"),
    ("picked_up", "Order has been picked up"),
    ("in_transit", "Order is moving through the courier network"),
    ("delivered", "Order has been delivered"),
    ("failed", "Delivery attempt failed"),
    ("cancelled", "Order has been cancelled"),
    ("returned", "Order has been returned to sender"),
    ("awaiting_payment", "Order is awaiting payment"),
    ("payment_received", "Payment has been received"),
]

ZONES = [
    ("Rawalpindi", "Rawalpindi and Islamabad service zone"),
    ("Lahore", "Lahore metro service zone"),
    ("Karachi", "Karachi metro service zone"),
]

BRANCHES = [
    {
        "name": "Rawalpindi HQ",
        "zone": "Rawalpindi",
        "address": "Saddar, Rawalpindi",
        "phone": "0515550101",
        "email": "rwp.hq@fastex.com",
        "latitude": "33.5950",
        "longitude": "73.0528",
    },
    {
        "name": "Lahore Central",
        "zone": "Lahore",
        "address": "Gulberg, Lahore",
        "phone": "0425550101",
        "email": "lhr.central@fastex.com",
        "latitude": "31.5204",
        "longitude": "74.3587",
    },
    {
        "name": "Karachi Main",
        "zone": "Karachi",
        "address": "Shahrah-e-Faisal, Karachi",
        "phone": "0215550101",
        "email": "khi.main@fastex.com",
        "latitude": "24.8607",
        "longitude": "67.0011",
    },
]

USERS = [
    ("Super Admin", "superadmin@fastex.com", "03000000001", "6110100000001", "super_admin"),
    ("Operations Admin", "admin@fastex.com", "03000000002", "6110100000002", "admin"),
    ("Rawalpindi Staff", "rwp.staff@fastex.com", "03000000003", "6110100000003", "staff"),
    ("Lahore Staff", "lhr.staff@fastex.com", "03000000004", "6110100000004", "staff"),
    ("Rawalpindi Rider", "rwp.rider@fastex.com", "03000000005", "6110100000005", "rider"),
    ("Lahore Rider", "lhr.rider@fastex.com", "03000000006", "6110100000006", "rider"),
    ("Ayesha Customer", "ayesha.customer@example.com", "03000000007", "6110100000007", "customer"),
    ("Bilal Customer", "bilal.customer@example.com", "03000000008", "6110100000008", "customer"),
]

ADDRESSES = [
    ("Ayesha Pickup", "House 12, Satellite Town, Rawalpindi", "Rawalpindi", "Ayesha Khan", "03000000007", 33.6261, 73.0714),
    ("Ayesha Dropoff", "Office 44, Blue Area, Islamabad", "Islamabad", "Hassan Ali", "03000000107", 33.7215, 73.0433),
    ("Bilal Pickup", "Block B, Gulberg III, Lahore", "Lahore", "Bilal Ahmed", "03000000008", 31.5102, 74.3441),
    ("Bilal Dropoff", "DHA Phase 5, Lahore", "Lahore", "Sara Malik", "03000000108", 31.4628, 74.4098),
]


def get_or_create(db: Session, model, defaults=None, **filters):
    instance = db.query(model).filter_by(**filters).first()
    if instance:
        return instance, False

    payload = dict(filters)
    if defaults:
        payload.update(defaults)
    instance = model(**payload)
    db.add(instance)
    db.flush()
    return instance, True


def seed_roles(db: Session):
    roles = {}
    for name, description in ROLES:
        role, _ = get_or_create(db, Role, name=name, defaults={"description": description})
        roles[name] = role
    return roles


def seed_statuses(db: Session):
    for name, description in STATUSES:
        get_or_create(db, Status, name=name, defaults={"description": description})


def seed_zones(db: Session):
    zones = {}
    for name, description in ZONES:
        zone, _ = get_or_create(
            db,
            Zone,
            name=name,
            defaults={"description": description, "is_active": True},
        )
        zones[name] = zone
    return zones


def seed_branches(db: Session, zones):
    branches = {}
    for item in BRANCHES:
        branch, _ = get_or_create(
            db,
            Branch,
            name=item["name"],
            defaults={
                "address": item["address"],
                "zone_id": zones[item["zone"]].id,
                "phone": item["phone"],
                "email": item["email"],
                "latitude": item["latitude"],
                "longitude": item["longitude"],
                "opening_time": "09:00",
                "closing_time": "18:00",
                "status": "active",
            },
        )
        branches[item["name"]] = branch
    return branches


def seed_pricing(db: Session, zones):
    for zone in zones.values():
        for weight_min, weight_max, price in [(0, 500, 250), (501, 1000, 350), (1001, 5000, 600)]:
            existing = (
                db.query(PricingRule)
                .filter(
                    PricingRule.zone_id == zone.id,
                    PricingRule.weight_range_min == weight_min,
                    PricingRule.weight_range_max == weight_max,
                )
                .first()
            )
            if not existing:
                db.add(
                    PricingRule(
                        zone_id=zone.id,
                        weight_range_min=weight_min,
                        weight_range_max=weight_max,
                        price=price,
                        extra_per_kg=120,
                        fuel_surcharge_percentage=5,
                        tax_percentage=16,
                    )
                )
    db.flush()


def seed_users(db: Session, roles):
    users = {}
    password = hash_password(PASSWORD)
    for full_name, email, phone, cnic, role_name in USERS:
        user, _ = get_or_create(
            db,
            User,
            email=email,
            defaults={
                "full_name": full_name,
                "phone": phone,
                "cnic": cnic,
                "hashed_password": password,
                "role_id": roles[role_name].id,
                "is_active": True,
                "is_verified": True,
            },
        )
        users[email] = user
    return users


def seed_profiles(db: Session, users, branches):
    profile_map = [
        ("rwp.staff@fastex.com", "STF-RWP-001", branches["Rawalpindi HQ"]),
        ("lhr.staff@fastex.com", "STF-LHR-001", branches["Lahore Central"]),
    ]
    for email, code, branch in profile_map:
        get_or_create(
            db,
            StaffProfile,
            user_id=users[email].id,
            defaults={
                "employee_code": code,
                "branch_id": branch.id,
                "branch_name": branch.name,
                "branch_location": branch.address,
            },
        )

    rider_map = [
        ("rwp.rider@fastex.com", branches["Rawalpindi HQ"], "LIC-RWP-001", 33.595, 73.053),
        ("lhr.rider@fastex.com", branches["Lahore Central"], "LIC-LHR-001", 31.520, 74.359),
    ]
    riders = {}
    for email, branch, license_number, lat, lng in rider_map:
        rider, _ = get_or_create(
            db,
            RiderProfile,
            user_id=users[email].id,
            defaults={
                "branch_id": branch.id,
                "vehicle_type": "bike",
                "license_number": license_number,
                "status": RiderStatus.active,
                "is_available": True,
                "current_lat": lat,
                "current_lng": lng,
                "rating": 4.8,
            },
        )
        riders[email] = rider

    for email, customer_type, points in [
        ("ayesha.customer@example.com", "regular", 120),
        ("bilal.customer@example.com", "premium", 320),
    ]:
        get_or_create(
            db,
            Customer,
            user_id=users[email].id,
            defaults={
                "customer_type": customer_type,
                "loyalty_points": points,
                "preferred_payment_method": "cash",
            },
        )
    return riders


def seed_businesses(db: Session):
    get_or_create(
        db,
        Business,
        email="accounts@northstartraders.example",
        defaults={
            "company_name": "North Star Traders",
            "phone": "03000000901",
            "address": "I-9 Industrial Area, Islamabad",
            "website": "https://northstartraders.example",
            "wallet_balance": 15000,
            "credit_limit": 50000,
            "status": "active",
            "is_active": True,
        },
    )


def seed_warehouses(db: Session, branches, users):
    warehouse_map = [
        ("Rawalpindi Fulfillment Warehouse", branches["Rawalpindi HQ"], users["admin@fastex.com"]),
        ("Lahore Sorting Warehouse", branches["Lahore Central"], users["admin@fastex.com"]),
    ]
    for name, branch, manager in warehouse_map:
        get_or_create(
            db,
            Warehouse,
            name=name,
            defaults={"branch_id": branch.id, "manager_id": manager.id, "status": "active"},
        )


def seed_routes(db: Session):
    routes = {}
    for origin, destination, distance, minutes in [
        ("Rawalpindi", "Islamabad", 18, 45),
        ("Gulberg Lahore", "DHA Lahore", 13, 35),
    ]:
        route, _ = get_or_create(
            db,
            Route,
            origin=origin,
            destination=destination,
            defaults={"distance_km": distance, "estimated_time_min": minutes},
        )
        routes[(origin, destination)] = route
    return routes


def seed_addresses(db: Session):
    addresses = {}
    for label, full_address, city, contact_name, contact_phone, lat, lng in ADDRESSES:
        address, _ = get_or_create(
            db,
            Address,
            label=label,
            defaults={
                "full_address": full_address,
                "city": city,
                "contact_name": contact_name,
                "contact_phone": contact_phone,
                "lat": lat,
                "lng": lng,
            },
        )
        addresses[label] = address
    return addresses


def seed_orders(db: Session, users, riders, zones, branches, addresses):
    orders = {}
    order_payloads = [
        {
            "tracking_number": "CR1000000001",
            "customer": users["ayesha.customer@example.com"],
            "created_by": users["ayesha.customer@example.com"],
            "created_by_type": CreatedByType.customer,
            "booking_channel": BookingChannel.online,
            "pickup": addresses["Ayesha Pickup"],
            "dropoff": addresses["Ayesha Dropoff"],
            "weight": 1.2,
            "description": "Documents and small parcel",
            "status": OrderStatus.assigned,
            "rider": riders["rwp.rider@fastex.com"],
            "zone": zones["Rawalpindi"],
            "branch": branches["Rawalpindi HQ"],
            "price": 420.0,
            "accepted": True,
        },
        {
            "tracking_number": "CR1000000002",
            "customer": users["bilal.customer@example.com"],
            "created_by": users["lhr.staff@fastex.com"],
            "created_by_type": CreatedByType.staff,
            "booking_channel": BookingChannel.walk_in,
            "pickup": addresses["Bilal Pickup"],
            "dropoff": addresses["Bilal Dropoff"],
            "weight": 2.5,
            "description": "Clothing package",
            "status": OrderStatus.in_transit,
            "rider": riders["lhr.rider@fastex.com"],
            "zone": zones["Lahore"],
            "branch": branches["Lahore Central"],
            "price": 620.0,
            "accepted": True,
        },
    ]

    for payload in order_payloads:
        order, _ = get_or_create(
            db,
            Order,
            tracking_number=payload["tracking_number"],
            defaults={
                "customer_id": payload["customer"].id,
                "created_by_type": payload["created_by_type"],
                "created_by_id": payload["created_by"].id,
                "booking_channel": payload["booking_channel"],
                "pickup_address_id": payload["pickup"].id,
                "dropoff_address_id": payload["dropoff"].id,
                "package_weight_kg": payload["weight"],
                "package_description": payload["description"],
                "status": payload["status"],
                "rider_id": payload["rider"].id,
                "rider_accepted": payload["accepted"],
                "zone_id": payload["zone"].id,
                "branch_id": payload["branch"].id,
                "estimated_price": payload["price"],
                "final_price": payload["price"],
            },
        )
        orders[payload["tracking_number"]] = order
    return orders


def seed_order_details(db: Session, orders, users, riders):
    for tracking_number, order in orders.items():
        get_or_create(
            db,
            Payment,
            order_id=order.id,
            defaults={
                "amount": order.final_price or order.estimated_price or 0,
                "method": PaymentMethod.cash,
                "status": PaymentStatus.paid if tracking_number.endswith("2") else PaymentStatus.pending,
                "idempotency_key": f"seed-{tracking_number}",
                "collected_by_staff_id": users["lhr.staff@fastex.com"].id if tracking_number.endswith("2") else None,
            },
        )
        get_or_create(
            db,
            Invoice,
            order_id=order.id,
            defaults={"amount": int(order.final_price or 0), "status": "paid" if tracking_number.endswith("2") else "unpaid"},
        )
        get_or_create(
            db,
            RiderAssignment,
            order_id=order.id,
            rider_id=order.rider_id,
            defaults={"status": "in_progress" if tracking_number.endswith("2") else "assigned"},
        )
        get_or_create(
            db,
            LiveTracking,
            order_id=order.id,
            defaults={"latitude": "31.5102", "longitude": "74.3441", "speed_kmh": 28, "status": "in_transit"},
        )
        get_or_create(
            db,
            DeliveryAttempt,
            order_id=order.id,
            attempt_number=1,
            defaults={"status": "scheduled", "notes": "First delivery attempt scheduled"},
        )

        if not db.query(TrackingEvent).filter_by(order_id=order.id, status="created").first():
            db.add(
                TrackingEvent(
                    order_id=order.id,
                    status="created",
                    note="Shipment booked",
                    changed_by_id=order.created_by_id,
                )
            )
        if not db.query(OrderStatusHistory).filter_by(order_id=order.id, status=order.status.value).first():
            db.add(
                OrderStatusHistory(
                    order_id=order.id,
                    status=order.status.value,
                    changed_by_id=order.created_by_id,
                    remark="Seeded current order status",
                )
            )


def seed_supporting_data(db: Session, users, branches, orders):
    admin = users["admin@fastex.com"]
    customer = users["ayesha.customer@example.com"]
    order = orders["CR1000000001"]

    get_or_create(
        db,
        Announcement,
        title="Same-day pickup window updated",
        defaults={
            "body": "Same-day pickups close at 5 PM for all metro branches.",
            "branch_id": branches["Rawalpindi HQ"].id,
            "created_by_id": admin.id,
            "is_active": True,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        },
    )
    get_or_create(
        db,
        Notification,
        user_id=customer.id,
        title="Shipment assigned",
        defaults={
            "type": "info",
            "message": "Your shipment CR1000000001 has been assigned to a rider.",
            "is_read": False,
        },
    )
    get_or_create(
        db,
        ActivityLog,
        user_id=admin.id,
        action="seed_demo_data",
        defaults={"details": "Demo data seeded from seed.py"},
    )
    get_or_create(
        db,
        AuditLog,
        user_id=admin.id,
        action="create_order",
        entity_type="Order",
        entity_id=order.id,
        defaults={"details": "Seeded sample order"},
    )
    for key, value in [
        ("currency", "PKR"),
        ("default_cod_enabled", "true"),
        ("support_phone", "021111327839"),
        ("max_package_weight_kg", "30"),
    ]:
        get_or_create(db, SystemSetting, key=key, defaults={"value": value})


def seed():
    db = SessionLocal()
    try:
        roles = seed_roles(db)
        seed_statuses(db)
        zones = seed_zones(db)
        branches = seed_branches(db, zones)
        seed_pricing(db, zones)
        users = seed_users(db, roles)
        riders = seed_profiles(db, users, branches)
        seed_businesses(db)
        seed_warehouses(db, branches, users)
        seed_routes(db)
        addresses = seed_addresses(db)
        orders = seed_orders(db, users, riders, zones, branches, addresses)
        seed_order_details(db, orders, users, riders)
        seed_supporting_data(db, users, branches, orders)
        db.commit()
        print("Database seeded successfully.")
        print(f"Demo password for seeded users: {PASSWORD}")
        print("Admin login: admin@fastex.com / Password123")
        print("Customer login: ayesha.customer@example.com / Password123")
        print("Rider login: rwp.rider@fastex.com / Password123")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
