"""rebuild invoice with real fields (invoice_number, subtotal, discount_amount, tax_amount, total_amount)

The invoices table was scaffolded early on and never wired into any business
logic - a handful of leftover seed/test rows exist, but nothing in the app
creates or queries Invoice rows in practice. Replacing the single Integer
`amount` column (which silently truncated fractional prices) with a proper
subtotal/discount/tax/total breakdown plus a deterministic invoice_number
(f"INV-{order.tracking_number}"), now that Phase 4 wires real invoice
creation into order booking. The handful of existing rows are backfilled
from their linked order rather than dropped.

Revision ID: 644a8cc2d036
Revises: 8a1f2c9d4b06
Create Date: 2026-08-18 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '644a8cc2d036'
down_revision = '8a1f2c9d4b06'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('invoices', 'amount')
    op.add_column('invoices', sa.Column('invoice_number', sa.String(length=50), nullable=True))
    op.add_column('invoices', sa.Column('subtotal', sa.Float(), nullable=True))
    op.add_column('invoices', sa.Column('discount_amount', sa.Float(), nullable=True))
    op.add_column('invoices', sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('invoices', sa.Column('total_amount', sa.Float(), nullable=True))

    # Backfill any pre-existing rows from their linked order before tightening
    # the new columns to NOT NULL.
    op.execute(
        """
        UPDATE invoices
        SET invoice_number = 'INV-' || orders.tracking_number,
            subtotal = COALESCE(orders.estimated_price, 0.0),
            total_amount = COALESCE(orders.final_price, orders.estimated_price, 0.0)
        FROM orders
        WHERE orders.id = invoices.order_id
        """
    )

    op.alter_column('invoices', 'invoice_number', nullable=False)
    op.alter_column('invoices', 'subtotal', nullable=False)
    op.alter_column('invoices', 'total_amount', nullable=False)
    op.create_index(op.f('ix_invoices_invoice_number'), 'invoices', ['invoice_number'], unique=True)


def downgrade():
    op.drop_index(op.f('ix_invoices_invoice_number'), table_name='invoices')
    op.add_column('invoices', sa.Column('amount', sa.Integer(), nullable=True))
    op.execute("UPDATE invoices SET amount = ROUND(total_amount)::integer")
    op.alter_column('invoices', 'amount', nullable=False)
    op.drop_column('invoices', 'total_amount')
    op.drop_column('invoices', 'tax_amount')
    op.drop_column('invoices', 'discount_amount')
    op.drop_column('invoices', 'subtotal')
    op.drop_column('invoices', 'invoice_number')
