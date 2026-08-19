"""add bus_manifests.origin_branch_id and delivery_attempts.reason

Revision ID: 7f4c1a9e2b3d
Revises: 32295cfb315f
Create Date: 2026-08-19 00:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7f4c1a9e2b3d'
down_revision = '32295cfb315f'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('bus_manifests', sa.Column('origin_branch_id', sa.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key(
        'fk_bus_manifests_origin_branch_id_branches',
        'bus_manifests', 'branches',
        ['origin_branch_id'], ['id'],
    )
    op.add_column('delivery_attempts', sa.Column('reason', sa.String(length=50), nullable=True))


def downgrade():
    op.drop_column('delivery_attempts', 'reason')
    op.drop_constraint('fk_bus_manifests_origin_branch_id_branches', 'bus_manifests', type_='foreignkey')
    op.drop_column('bus_manifests', 'origin_branch_id')
