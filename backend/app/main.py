import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.api.v1.router import api_router

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

# Serves proof-of-delivery photos and any other locally-stored uploads.
# In production this should move to S3/CloudFront rather than local disk.
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Courier Service API is running"}
