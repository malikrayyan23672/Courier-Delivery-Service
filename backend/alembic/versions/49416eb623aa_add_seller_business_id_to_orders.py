"""add seller_business_id to orders

Revision ID: 49416eb623aa
Revises: a917ce103027
Create Date: 2026-08-17 12:27:03.619664

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '49416eb623aa'
down_revision = 'a917ce103027'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('orders', sa.Column('seller_business_id', sa.UUID(as_uuid=False), nullable=True))
    op.create_index(op.f('ix_orders_seller_business_id'), 'orders', ['seller_business_id'], unique=False)
    op.create_foreign_key(None, 'orders', 'businesses', ['seller_business_id'], ['id'])
    # Backfill: every marketplace order (has a product) already implies a
    # seller via product.business_id - this column just makes it a direct,
    # queryable field instead of always needing the join.
    op.execute(
        """
        UPDATE orders
        SET seller_business_id = products.business_id
        FROM products
        WHERE orders.product_id = products.id
          AND orders.seller_business_id IS NULL
        """
    )
    # (pre-existing riders.cod_cash_held/cod_wallet_locked nullability drift
    # intentionally left alone here - unrelated to this change)


def downgrade():
    op.drop_constraint(None, 'orders', type_='foreignkey')
    op.drop_index(op.f('ix_orders_seller_business_id'), table_name='orders')
    op.drop_column('orders', 'seller_business_id')
