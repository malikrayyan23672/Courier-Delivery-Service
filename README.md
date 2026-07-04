# Courier Service Platform

Full-stack courier/delivery service: **FastAPI + PostgreSQL backend**, **Next.js frontend** (FastEx brand theme).

## Structure

- `backend/` — FastAPI API (see `backend/README.md` for setup)
- `frontend/` — Next.js customer-facing app (see `frontend/README.md` for setup)
- `bruno-collection/` — API test collection for the Bruno client
- `design-reference/` — original FastEx HTML mockups the frontend theme is based on

Backend supports four roles: **customer**, **staff** (office walk-in booking), **rider**, and **admin/super_admin**.

## Tech Stack
- FastAPI (async Python web framework)
- PostgreSQL (primary database)
- SQLAlchemy + Alembic (ORM + migrations)
- Redis + Celery (background jobs, rate limiting)
- JWT auth with role-based access control (RBAC)

## Project Structure
See `backend/app/` — organized by domain:
- `models/` — SQLAlchemy tables (User, Role, Order, RiderProfile, StaffProfile, Payment, TrackingEvent, Address)
- `schemas/` — Pydantic request/response validation
- `api/v1/` — routers split by role (auth, customer, staff, rider, admin, tracking)
- `core/` — security (JWT, password hashing) and RBAC permission checks
- `services/` — business logic (order creation, pricing) shared across routers
- `tasks/` — Celery background jobs

## Getting Started (Docker — recommended)

```bash
cd backend
cp .env.example .env          # then edit SECRET_KEY and other values
docker-compose up --build
```

This starts FastAPI (port 8000), PostgreSQL (port 5432), Redis, and a Celery worker.

Once containers are up, run migrations and seed roles:

```bash
docker exec -it courier_api alembic revision --autogenerate -m "initial tables"
docker exec -it courier_api alembic upgrade head
docker exec -it courier_api python seed_roles.py
```

API docs available at: **http://localhost:8000/docs**

## Getting Started (without Docker)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # edit DATABASE_URL to point at your local Postgres

alembic revision --autogenerate -m "initial tables"
alembic upgrade head
python seed_roles.py

uvicorn app.main:app --reload
```

## Roles Implemented (v1)
| Role | Access |
|---|---|
| `customer` | Book orders online, view own order history, track shipments |
| `staff` | Book walk-in orders on behalf of customers, collect cash payments |
| `rider` | View assigned deliveries, update delivery status |
| `admin` / `super_admin` | View all orders, assign riders to orders |

Roles live in the `roles` table (data, not hardcoded) — add new ones (dispatcher, finance, support) without code changes to the permission system.

## Key Endpoints
- `POST /api/v1/auth/register` — customer self-registration
- `POST /api/v1/auth/login` — returns access + refresh JWT
- `POST /api/v1/customer/orders` — customer books a shipment
- `POST /api/v1/staff/orders` — staff books on behalf of a walk-in customer
- `GET /api/v1/tracking/{tracking_number}` — public tracking, no auth required
- `PATCH /api/v1/rider/deliveries/{order_id}/status` — rider updates delivery status
- `PATCH /api/v1/admin/orders/{order_id}/assign-rider/{rider_id}` — admin assigns a rider

## Not Yet Implemented (next steps)
- Real geocoding/distance calc for pricing (currently a placeholder in `pricing_service.py`)
- Payment gateway integration (Stripe/PayPal) + webhook signature verification
- File upload for proof-of-delivery images (S3 + signed URLs)
- Rate limiting on public endpoints (`slowapi` is installed but not yet wired into routes)
- Real notification sending (SMS/email — Celery task stub exists in `tasks/notification_tasks.py`)
- Frontend applications for each of the four panels
