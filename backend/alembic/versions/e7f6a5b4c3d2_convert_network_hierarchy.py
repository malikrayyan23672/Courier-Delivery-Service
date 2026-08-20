"""convert network hierarchy to headquarter -> hub -> branch -> local branch

Revision ID: e7f6a5b4c3d2
Revises: a8fb53f8b6b7
Create Date: 2026-08-20 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7f6a5b4c3d2'
down_revision = 'a8fb53f8b6b7'
branch_labels = None
depends_on = None


def upgrade():
    # ---- 1. headquarters - the new top tier of the network ----
    op.create_table('headquarters',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('address', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=150), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('manager_id', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['manager_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # ---- 2. swap the two middle tiers. The city main offices (branches)
    # become the "hub" tier and the sorting facilities (hubs) become the
    # "branch" tier. PostgreSQL automatically repoints every FK that
    # referenced the renamed tables, so rows and ids stay intact. ----
    op.rename_table('branches', 'branches_tmp')
    op.rename_table('hubs', 'branches')
    op.rename_table('branches_tmp', 'hubs')
    op.rename_table('local_offices', 'local_branches')

    # ---- 3. branches (former hubs): branch_id -> hub_id (points up to parent hub) ----
    op.alter_column('branches', 'branch_id', new_column_name='hub_id')
    op.execute('ALTER TABLE branches RENAME CONSTRAINT hubs_branch_id_fkey TO branches_hub_id_fkey')

    # ---- 4. local_branches (former local_offices): hub_id -> branch_id ----
    op.alter_column('local_branches', 'hub_id', new_column_name='branch_id')
    op.execute('ALTER TABLE local_branches RENAME CONSTRAINT local_offices_hub_id_fkey TO local_branches_branch_id_fkey')

    # ---- 5. staff_profiles: swap branch_id <-> hub_id (values unchanged),
    # local_office_id -> local_branch_id ----
    op.alter_column('staff_profiles', 'branch_id', new_column_name='tmp_hub_id')
    op.alter_column('staff_profiles', 'hub_id', new_column_name='branch_id')
    op.alter_column('staff_profiles', 'tmp_hub_id', new_column_name='hub_id')
    op.alter_column('staff_profiles', 'local_office_id', new_column_name='local_branch_id')
    op.execute('ALTER TABLE staff_profiles RENAME CONSTRAINT staff_profiles_branch_id_fkey TO staff_profiles_hub_id_tmp')
    op.execute('ALTER TABLE staff_profiles RENAME CONSTRAINT staff_profiles_hub_id_fkey TO staff_profiles_branch_id_fkey')
    op.execute('ALTER TABLE staff_profiles RENAME CONSTRAINT staff_profiles_hub_id_tmp TO staff_profiles_hub_id_fkey')
    op.execute('ALTER TABLE staff_profiles RENAME CONSTRAINT staff_profiles_local_office_id_fkey TO staff_profiles_local_branch_id_fkey')

    # ---- 6. orders ----
    op.alter_column('orders', 'branch_id', new_column_name='hub_id')
    op.alter_column('orders', 'local_office_id', new_column_name='local_branch_id')
    op.execute('ALTER TABLE orders RENAME CONSTRAINT orders_branch_id_fkey TO orders_hub_id_fkey')
    op.execute('ALTER TABLE orders RENAME CONSTRAINT orders_local_office_id_fkey TO orders_local_branch_id_fkey')

    # ---- 7. riders, warehouses, announcements, service areas, incidents:
    # branch_id -> hub_id (they all attach to the city tier, now a hub) ----
    op.alter_column('riders', 'branch_id', new_column_name='hub_id')
    op.execute('ALTER TABLE riders RENAME CONSTRAINT riders_branch_id_fkey TO riders_hub_id_fkey')
    op.alter_column('warehouses', 'branch_id', new_column_name='hub_id')
    op.execute('ALTER TABLE warehouses RENAME CONSTRAINT warehouses_branch_id_fkey TO warehouses_hub_id_fkey')
    op.alter_column('announcements', 'branch_id', new_column_name='hub_id')
    op.execute('ALTER TABLE announcements RENAME CONSTRAINT announcements_branch_id_fkey TO announcements_hub_id_fkey')
    op.alter_column('branch_service_areas', 'branch_id', new_column_name='hub_id')
    op.execute('ALTER TABLE branch_service_areas RENAME CONSTRAINT branch_service_areas_branch_id_fkey TO branch_service_areas_hub_id_fkey')
    op.alter_column('parcel_incidents', 'branch_id', new_column_name='hub_id')
    op.execute('ALTER TABLE parcel_incidents RENAME CONSTRAINT parcel_incidents_branch_id_fkey TO parcel_incidents_hub_id_fkey')

    # ---- 8. bus network legs: branch -> hub ----
    op.alter_column('bus_schedules', 'origin_branch_id', new_column_name='origin_hub_id')
    op.alter_column('bus_schedules', 'destination_branch_id', new_column_name='destination_hub_id')
    op.execute('ALTER TABLE bus_schedules RENAME CONSTRAINT bus_schedules_origin_branch_id_fkey TO bus_schedules_origin_hub_id_fkey')
    op.execute('ALTER TABLE bus_schedules RENAME CONSTRAINT bus_schedules_destination_branch_id_fkey TO bus_schedules_destination_hub_id_fkey')
    op.alter_column('bus_manifests', 'origin_branch_id', new_column_name='origin_hub_id')
    op.execute('ALTER TABLE bus_manifests RENAME CONSTRAINT fk_bus_manifests_origin_branch_id_branches TO bus_manifests_origin_hub_id_fkey')

    # ---- 9. hubs get headquarter_id; seed a head office and attach every hub ----
    op.add_column('hubs', sa.Column('headquarter_id', sa.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key('hubs_headquarter_id_fkey', 'hubs', 'headquarters', ['headquarter_id'], ['id'])
    conn = op.get_bind()
    conn.execute(sa.text(
        "INSERT INTO headquarters (id, name, status, created_at, updated_at) "
        "VALUES (gen_random_uuid(), 'Raftaar Express Head Office', 'active', now(), now())"
    ))
    conn.execute(sa.text(
        "UPDATE hubs SET headquarter_id = (SELECT id FROM headquarters LIMIT 1) WHERE headquarter_id IS NULL"
    ))


def downgrade():
    conn = op.get_bind()

    op.drop_constraint('hubs_headquarter_id_fkey', 'hubs', type_='foreignkey')
    op.drop_column('hubs', 'headquarter_id')
    conn.execute(sa.text("DELETE FROM headquarters"))

    op.alter_column('bus_manifests', 'origin_hub_id', new_column_name='origin_branch_id')
    op.execute('ALTER TABLE bus_manifests RENAME CONSTRAINT bus_manifests_origin_hub_id_fkey TO fk_bus_manifests_origin_branch_id_branches')
    op.alter_column('bus_schedules', 'destination_hub_id', new_column_name='destination_branch_id')
    op.alter_column('bus_schedules', 'origin_hub_id', new_column_name='origin_branch_id')
    op.execute('ALTER TABLE bus_schedules RENAME CONSTRAINT bus_schedules_destination_hub_id_fkey TO bus_schedules_destination_branch_id_fkey')
    op.execute('ALTER TABLE bus_schedules RENAME CONSTRAINT bus_schedules_origin_hub_id_fkey TO bus_schedules_origin_branch_id_fkey')

    op.alter_column('parcel_incidents', 'hub_id', new_column_name='branch_id')
    op.execute('ALTER TABLE parcel_incidents RENAME CONSTRAINT parcel_incidents_hub_id_fkey TO parcel_incidents_branch_id_fkey')
    op.alter_column('branch_service_areas', 'hub_id', new_column_name='branch_id')
    op.execute('ALTER TABLE branch_service_areas RENAME CONSTRAINT branch_service_areas_hub_id_fkey TO branch_service_areas_branch_id_fkey')
    op.alter_column('announcements', 'hub_id', new_column_name='branch_id')
    op.execute('ALTER TABLE announcements RENAME CONSTRAINT announcements_hub_id_fkey TO announcements_branch_id_fkey')
    op.alter_column('warehouses', 'hub_id', new_column_name='branch_id')
    op.execute('ALTER TABLE warehouses RENAME CONSTRAINT warehouses_hub_id_fkey TO warehouses_branch_id_fkey')
    op.alter_column('riders', 'hub_id', new_column_name='branch_id')
    op.execute('ALTER TABLE riders RENAME CONSTRAINT riders_hub_id_fkey TO riders_branch_id_fkey')

    op.alter_column('orders', 'local_branch_id', new_column_name='local_office_id')
    op.alter_column('orders', 'hub_id', new_column_name='branch_id')
    op.execute('ALTER TABLE orders RENAME CONSTRAINT orders_local_branch_id_fkey TO orders_local_office_id_fkey')
    op.execute('ALTER TABLE orders RENAME CONSTRAINT orders_hub_id_fkey TO orders_branch_id_fkey')

    op.alter_column('staff_profiles', 'local_branch_id', new_column_name='local_office_id')
    op.alter_column('staff_profiles', 'hub_id', new_column_name='tmp_hub_id')
    op.alter_column('staff_profiles', 'branch_id', new_column_name='hub_id')
    op.alter_column('staff_profiles', 'tmp_hub_id', new_column_name='branch_id')
    op.execute('ALTER TABLE staff_profiles RENAME CONSTRAINT staff_profiles_local_branch_id_fkey TO staff_profiles_local_office_id_fkey')
    op.execute('ALTER TABLE staff_profiles RENAME CONSTRAINT staff_profiles_hub_id_fkey TO staff_profiles_branch_id_fkey')
    op.execute('ALTER TABLE staff_profiles RENAME CONSTRAINT staff_profiles_branch_id_fkey TO staff_profiles_hub_id_fkey')

    op.alter_column('local_branches', 'branch_id', new_column_name='hub_id')
    op.execute('ALTER TABLE local_branches RENAME CONSTRAINT local_branches_branch_id_fkey TO local_offices_hub_id_fkey')
    op.alter_column('branches', 'hub_id', new_column_name='branch_id')
    op.execute('ALTER TABLE branches RENAME CONSTRAINT branches_hub_id_fkey TO hubs_branch_id_fkey')

    op.rename_table('local_branches', 'local_offices')
    op.rename_table('hubs', 'branches_tmp')
    op.rename_table('branches', 'hubs')
    op.rename_table('branches_tmp', 'branches')

    op.drop_table('headquarters')