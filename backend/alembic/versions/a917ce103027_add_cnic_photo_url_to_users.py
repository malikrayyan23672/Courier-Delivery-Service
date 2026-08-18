"""add cnic_photo_url to users

Revision ID: a917ce103027
Revises: 33492fe64bb8
Create Date: 2026-08-17 12:23:11.810067

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a917ce103027'
down_revision = '33492fe64bb8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('cnic_photo_url', sa.String(length=500), nullable=True))
    # (pre-existing riders.cod_cash_held/cod_wallet_locked nullability drift
    # intentionally left alone here - unrelated to this change)


def downgrade():
    op.drop_column('users', 'cnic_photo_url')
