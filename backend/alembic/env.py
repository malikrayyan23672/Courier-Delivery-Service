from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

import sys
import os

sys.path.append(os.getcwd())

from app.config import settings
from app.database import Base
from app import models  # noqa: F401 - ensures all models are registered on Base.metadata
from app.models import activity_log
from app.models import address
from app.models import announcement
from app.models import audit_log
from app.models import base
from app.models import branch
from app.models import business
from app.models import customer
from app.models import delivery_attempt
from app.models import invoice
from app.models import live_tracking
from app.models import notification
from app.models import order_status_history
from app.models import order
from app.models import payment
from app.models import phone_otp
from app.models import pricing_rule
from app.models import rider_assignment
from app.models import rider
from app.models import role
from app.models import route
from app.models import staff
from app.models import status
from app.models import system_setting
from app.models import live_tracking
from app.models import user
from app.models import warehouse
from app.models import zone


config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
