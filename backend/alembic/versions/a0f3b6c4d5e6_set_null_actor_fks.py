"""set null on operational actor foreign keys

Several nullable "actor" FKs reference users with the default ON DELETE
RESTRICT, which blocks deleting a user who is merely referenced (e.g. a staff
member who collected a cash payment). These are operational links, not hard
audit rows, so deleting the user should vacate the reference (SET NULL) rather
than fail - matching the existing treatment of branch.manager_id,
parcel_incident.reported_by_id, etc.

Revision ID: a0f3b6c4d5e6
Revises: 1497c1deb76e
"""
from alembic import op

# (table, column, constraint_name)
_ACTOR_FKS = [
    ("payments", "collected_by_staff_id", "payments_collected_by_staff_id_fkey"),
    ("tracking_events", "changed_by_id", "tracking_events_changed_by_id_fkey"),
    ("warehouses", "manager_id", "warehouses_manager_id_fkey"),
    ("settlements", "settled_by_id", "settlements_settled_by_id_fkey"),
    ("seller_uploads", "uploaded_by_id", "seller_uploads_uploaded_by_id_fkey"),
]

revision = "a0f3b6c4d5e6"
down_revision = "1497c1deb76e"
branch_labels = None
depends_on = None


def _recreate(ondelete: str) -> None:
    for table, column, name in _ACTOR_FKS:
        op.execute(f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {name}')
        op.execute(
            f'ALTER TABLE {table} ADD CONSTRAINT {name} '
            f'FOREIGN KEY ({column}) REFERENCES users (id) ON DELETE {ondelete}'
        )


def upgrade():
    # Vacate the reference instead of blocking the delete.
    _recreate("SET NULL")


def downgrade():
    # Restore the original restrictive behaviour.
    _recreate("RESTRICT")
