from sqlalchemy import Column, Integer, String
from app.database import Base


class SystemSetting(Base):
    """Simple key-value store for app-wide settings (e.g. 'max_upload_size_mb')."""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(String(500), nullable=True)
