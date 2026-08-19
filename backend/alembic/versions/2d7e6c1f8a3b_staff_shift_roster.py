"""add shift_start/shift_end/shift_days to staff_profiles

Revision ID: 2d7e6c1f8a3b
Revises: 9b3d5e7f1a20
Create Date: 2026-08-19 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2d7e6c1f8a3b'
down_revision = '9b3d5e7f1a20'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('staff_profiles', sa.Column('shift_start', sa.String(length=10), nullable=True))
    op.add_column('staff_profiles', sa.Column('shift_end', sa.String(length=10), nullable=True))
    op.add_column('staff_profiles', sa.Column('shift_days', sa.String(length=50), nullable=True))


def downgrade():
    op.drop_column('staff_profiles', 'shift_days')
    op.drop_column('staff_profiles', 'shift_end')
    op.drop_column('staff_profiles', 'shift_start')
