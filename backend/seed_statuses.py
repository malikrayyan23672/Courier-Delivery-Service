"""
Run once after migrations: python seed_roles.py
Seeds the statuses table required before any user can register.
"""
from app.database import SessionLocal
from app.models.status import Status

STATUSES = [
    ("pending", "Order has been placed but not yet processed"),
    ("shipped", "Order has been shipped and is in transit"),
    ("delivered", "Order has been delivered to the customer"),
    ("cancelled", "Order has been cancelled"),
    ("booked", "Order has been booked but not yet shipped"),
    ("confirmed", "Order has been confirmed and is ready for shipment"),
    ("failed", "Order delivery has failed"),
    ("returned", "Order has been returned to the sender"),
    ("picked_up", "Order has been picked up by the delivery partner"),
    ("in_transit", "Order is currently in transit to the destination"),
    ("out_for_delivery", "Order is out for delivery to the customer"),
    ("delayed", "Order delivery has been delayed"),
    ("rescheduled", "Order delivery has been rescheduled"),
    ("awaiting_pickup", "Order is awaiting pickup by the customer"),
    ("awaiting_payment", "Order is awaiting payment from the customer"),
    ("payment_received", "Payment for the order has been received"),
    ("payment_failed", "Payment for the order has failed"),
    ("refunded", "Payment for the order has been refunded"),
    ("lost", "Order has been lost during transit"),
    ("damaged", "Order has been damaged during transit"),
    ("out_of_stock", "Item in the order is out of stock"),
    ("backordered", "Item in the order is on backorder"),
    ("partially_shipped", "Part of the order has been shipped"),
    ("partially_delivered", "Part of the order has been delivered"),
    ("partially_cancelled", "Part of the order has been cancelled"),
]


def seed():
    db = SessionLocal()
    try:
        for name, description in STATUSES:
            if not db.query(Status).filter(Status.name == name).first():
                db.add(Status(name=name, description=description))
        db.commit()
        print("Statuses seeded successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
