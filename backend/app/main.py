from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1.router import api_router

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


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Courier Service API is running"}
