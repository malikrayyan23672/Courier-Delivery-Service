from fastapi import APIRouter

from app.api.v1 import auth, customer, staff, rider, admin, tracking, manager
from app.api.v1 import settlements, wallets, rnp as rnp_admin, bus_network, seller, discounts

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(customer.router)
api_router.include_router(staff.router)
api_router.include_router(rider.router)
api_router.include_router(admin.router)
api_router.include_router(tracking.router)
api_router.include_router(manager.router)
api_router.include_router(settlements.router)
api_router.include_router(wallets.router)
api_router.include_router(rnp_admin.router)
api_router.include_router(bus_network.router)
api_router.include_router(bus_network.public_router)
api_router.include_router(seller.router)
api_router.include_router(discounts.router)
