from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class SellerUpload(Base, TimestampMixin):
    """
    Files uploaded by a seller through the seller portal - bulk order lists in
    CSV, Excel, or Word format. Stored on local disk (same approach as
    proof-of-delivery photos); the AI platform layer can later parse these.
    """
    __tablename__ = "seller_uploads"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    business_id = Column(UUID_TYPE, ForeignKey("businesses.id"), nullable=False)
    business = relationship("Business", back_populates="uploads")

    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(20), nullable=True)   # csv / xlsx / doc / docx
    row_count = Column(Integer, nullable=True)
    status = Column(String(50), default="uploaded")  # uploaded / processing / processed / failed
    uploaded_by_id = Column(UUID_TYPE, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
