"""add parcel_incidents, orders.rto_collected_at, branches.warehouse_capacity

Revision ID: 9b3d5e7f1a20
Revises: 7f4c1a9e2b3d
Create Date: 2026-08-19 00:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9b3d5e7f1a20'
down_revision = '7f4c1a9e2b3d'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'parcel_incidents',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('branch_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('order_id', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('manifest_id', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('reported_by_id', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('resolution_note', sa.Text(), nullable=True),
        sa.Column('resolved_by_id', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id']),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
        sa.ForeignKeyConstraint(['manifest_id'], ['bus_manifests.id']),
        sa.ForeignKeyConstraint(['reported_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['resolved_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_parcel_incidents_branch_id'), 'parcel_incidents', ['branch_id'], unique=False)
    op.create_index(op.f('ix_parcel_incidents_status'), 'parcel_incidents', ['status'], unique=False)

    op.add_column('orders', sa.Column('rto_collected_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('branches', sa.Column('warehouse_capacity', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('branches', 'warehouse_capacity')
    op.drop_column('orders', 'rto_collected_at')
    op.drop_index(op.f('ix_parcel_incidents_status'), table_name='parcel_incidents')
    op.drop_index(op.f('ix_parcel_incidents_branch_id'), table_name='parcel_incidents')
    op.drop_table('parcel_incidents')
