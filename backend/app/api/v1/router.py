from fastapi import APIRouter

from app.api.v1 import auth, customer, staff, rider, admin, tracking

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(customer.router)
api_router.include_router(staff.router)
api_router.include_router(rider.router)
api_router.include_router(admin.router)
api_router.include_router(tracking.router)
