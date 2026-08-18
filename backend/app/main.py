import asyncio
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.api.v1.router import api_router
from app.core.ws_manager import set_main_loop

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="Courier Service API",
    version="1.0.0",
    description="Backend API for customer, staff, rider, and admin panels.",
)

app.add_middleware(
    CORSMiddleware,
    # allow_origins=settings.allowed_origins_list,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
async def _capture_main_loop() -> None:
    # See core/ws_manager.py - route handlers that push a WebSocket
    # notification run in a worker thread, so they need a reference to this
    # loop to schedule the send correctly via run_coroutine_threadsafe.
    set_main_loop(asyncio.get_running_loop())

# Serves proof-of-delivery photos and any other locally-stored uploads.
# In production this should move to S3/CloudFront rather than local disk.
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Courier Service API is running"}
