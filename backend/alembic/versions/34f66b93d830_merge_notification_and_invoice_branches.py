"""merge notification and invoice branches

Revision ID: 34f66b93d830
Revises: 3d7e5a1c9f42, 644a8cc2d036
Create Date: 2026-08-18 12:03:44.990240

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '34f66b93d830'
down_revision = ('3d7e5a1c9f42', '644a8cc2d036')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
