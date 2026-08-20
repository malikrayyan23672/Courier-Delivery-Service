"""
Run once after migrations: python seed_roles.py
Seeds the roles table required before any user can register.
"""
from app.database import SessionLocal
from app.models.role import Role

ROLES = [
    ("customer", "Books shipments and tracks orders"),
    ("staff", "Office/counter staff who book walk-in orders"),
    ("rider", "Delivery partner who fulfills orders"),
    ("admin", "Operations staff with broad management access"),
    ("manager", "Manages branch operations"),
    ("hub_manager", "Manages a single hub's inbound/outbound operations"),
    ("local_office_manager", "Manages a local office's walk-in bookings"),
    ("business", "Seller/enterprise account with access to the seller portal"),
    ("finance", "Manages COD settlements, payouts, rider wallets, and disputes"),
    ("super_admin", "Full system access including pricing and config"),
]


def seed():
    db = SessionLocal()
    try:
        for name, description in ROLES:
            if not db.query(Role).filter(Role.name == name).first():
                db.add(Role(name=name, description=description))
        db.commit()
        print("Roles seeded successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
