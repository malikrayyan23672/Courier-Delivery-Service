from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"


    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(Integer, nullable=True)
    value = Column(String, nullable=True)