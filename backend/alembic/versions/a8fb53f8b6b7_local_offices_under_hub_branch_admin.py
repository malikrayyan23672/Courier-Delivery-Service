"""local offices under hub, branch admin

Revision ID: a8fb53f8b6b7
Revises: 424a30d88c7c
Create Date: 2026-08-20 13:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a8fb53f8b6b7'
down_revision = '424a30d88c7c'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('branches', sa.Column('admin_id', sa.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key('branches_admin_id_fkey', 'branches', 'users', ['admin_id'], ['id'])

    # local_offices moves from directly-under-branch to under-hub. Add the
    # new column nullable first, backfill each existing office onto a hub
    # within its current branch, then tighten to NOT NULL and drop the old
    # branch_id column/FK.
    op.add_column('local_offices', sa.Column('hub_id', sa.UUID(as_uuid=False), nullable=True))

    conn = op.get_bind()
    orphaned = conn.execute(sa.text("""
        SELECT lo.id, lo.branch_id
        FROM local_offices lo
        WHERE lo.hub_id IS NULL
    """)).fetchall()
    for office_id, branch_id in orphaned:
        hub_row = conn.execute(
            sa.text("SELECT id FROM hubs WHERE branch_id = :branch_id ORDER BY created_at LIMIT 1"),
            {"branch_id": branch_id},
        ).first()
        if hub_row is None:
            raise RuntimeError(
                f"local_office {office_id} belongs to branch {branch_id}, which has no hub yet - "
                "create a hub for this branch before running this migration."
            )
        conn.execute(
            sa.text("UPDATE local_offices SET hub_id = :hub_id WHERE id = :office_id"),
            {"hub_id": hub_row[0], "office_id": office_id},
        )

    op.alter_column('local_offices', 'hub_id', nullable=False)
    op.create_foreign_key('local_offices_hub_id_fkey', 'local_offices', 'hubs', ['hub_id'], ['id'])

    op.drop_constraint('local_offices_branch_id_fkey', 'local_offices', type_='foreignkey')
    op.drop_column('local_offices', 'branch_id')


def downgrade():
    op.add_column('local_offices', sa.Column('branch_id', sa.UUID(as_uuid=False), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT lo.id, h.branch_id FROM local_offices lo JOIN hubs h ON h.id = lo.hub_id")).fetchall()
    for office_id, branch_id in rows:
        conn.execute(
            sa.text("UPDATE local_offices SET branch_id = :branch_id WHERE id = :office_id"),
            {"branch_id": branch_id, "office_id": office_id},
        )

    op.alter_column('local_offices', 'branch_id', nullable=False)
    op.create_foreign_key('local_offices_branch_id_fkey', 'local_offices', 'branches', ['branch_id'], ['id'])

    op.drop_constraint('local_offices_hub_id_fkey', 'local_offices', type_='foreignkey')
    op.drop_column('local_offices', 'hub_id')

    op.drop_constraint('branches_admin_id_fkey', 'branches', type_='foreignkey')
    op.drop_column('branches', 'admin_id')
