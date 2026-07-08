from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.core.security import hash_password

from app.models.user import User
from app.models.staff import StaffProfile
from app.models.order import Order

