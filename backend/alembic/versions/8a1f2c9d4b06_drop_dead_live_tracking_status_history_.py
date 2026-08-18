"""drop dead live_tracking, order_status_history, rider_assignments tables

These three tables were scaffolded early on but never wired into any
business logic - TrackingEvent (order_id + status + note + lat/lng +
changed_by_id) already covers everything order_status_history and
rider_assignments would have, and RiderProfile.current_lat/current_lng
already covers live_tracking. Confirmed zero references anywhere outside
model declarations before writing this migration.

Revision ID: 8a1f2c9d4b06
Revises: 47eb7b5feedb
Create Date: 2026-08-18 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8a1f2c9d4b06'
down_revision = '47eb7b5feedb'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('rider_assignments')
    op.drop_table('order_status_history')
    op.drop_table('live_tracking')


def downgrade():
    op.create_table('live_tracking',
    sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
    sa.Column('order_id', sa.UUID(as_uuid=False), nullable=False),
    sa.Column('latitude', sa.String(length=50), nullable=True),
    sa.Column('longitude', sa.String(length=50), nullable=True),
    sa.Column('speed_kmh', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('order_status_history',
    sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
    sa.Column('order_id', sa.UUID(as_uuid=False), nullable=False),
    sa.Column('status', sa.String(length=50), nullable=False),
    sa.Column('changed_by_id', sa.UUID(as_uuid=False), nullable=True),
    sa.Column('remark', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['changed_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('rider_assignments',
    sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
    sa.Column('rider_id', sa.UUID(as_uuid=False), nullable=False),
    sa.Column('order_id', sa.UUID(as_uuid=False), nullable=False),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['rider_id'], ['riders.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
