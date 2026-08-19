from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, UUID_TYPE, gen_uuid


class StaffProfile(Base, TimestampMixin):
    """
    Office/counter staff who book orders on behalf of walk-in customers.
    Tied to a physical branch/office location for accountability + reporting.
    """
    __tablename__ = "staff_profiles"

    id = Column(UUID_TYPE, primary_key=True, default=gen_uuid)
    user_id = Column(UUID_TYPE, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    designation = Column(String(150), nullable=True)

    employee_code = Column(String(50), unique=True, nullable=True)
    branch_name = Column(String(150), nullable=True)
    branch_location = Column(String(255), nullable=True)

    # present / on_leave / absent - set by the branch manager from the staff roster.
    attendance_status = Column(String(20), nullable=False, default="present")

    # Shift roster - free-text time strings (matches Branch.opening_time's
    # convention, e.g. "09:00 AM") rather than a separate shift-table model,
    # since a branch manager just needs to record/see one recurring slot per
    # staff member, not build arbitrary per-day schedules.
    shift_start = Column(String(10), nullable=True)
    shift_end = Column(String(10), nullable=True)
    # Comma-separated weekday abbreviations, e.g. "Mon,Tue,Wed,Thu,Fri".
    shift_days = Column(String(50), nullable=True)

    branch_id = Column(UUID_TYPE, ForeignKey("branches.id"), nullable=True)
    branch = relationship("Branch", back_populates="staff_members")

    user = relationship("User", back_populates="staff_profile")
