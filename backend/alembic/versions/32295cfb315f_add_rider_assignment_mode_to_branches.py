"""add rider_assignment_mode to branches

Revision ID: 32295cfb315f
Revises: 2c5ae81c9d71
Create Date: 2026-08-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '32295cfb315f'
down_revision = '2c5ae81c9d71'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'branches',
        sa.Column('rider_assignment_mode', sa.String(length=20), nullable=False, server_default='manual'),
    )


def downgrade():
    op.drop_column('branches', 'rider_assignment_mode')
