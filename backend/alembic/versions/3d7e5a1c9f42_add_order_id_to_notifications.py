"""add order_id to notifications

Revision ID: 3d7e5a1c9f42
Revises: 8a1f2c9d4b06
Create Date: 2026-08-18 12:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3d7e5a1c9f42'
down_revision = '8a1f2c9d4b06'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('notifications', sa.Column('order_id', sa.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key(
        'fk_notifications_order_id_orders', 'notifications', 'orders', ['order_id'], ['id']
    )


def downgrade():
    op.drop_constraint('fk_notifications_order_id_orders', 'notifications', type_='foreignkey')
    op.drop_column('notifications', 'order_id')
