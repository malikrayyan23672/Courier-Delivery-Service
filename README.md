# Courier Service Platform

Full-stack courier/delivery service: **FastAPI + PostgreSQL backend**, **Next.js frontend** (FastEx brand theme).

## Structure

- `backend/` — FastAPI API
- `frontend/` — Next.js customer-facing app (see `frontend/README.md` for frontend-specific detail)
- `bruno-collection/` — API test collection for the Bruno client
- `design-reference/` — original FastEx HTML mockups the frontend theme is based on
- `docker-compose.yml` (root) — runs the entire stack together in one command

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

## Getting Started — Full Stack (Docker, recommended)

Runs backend, frontend, PostgreSQL, Redis, and the Celery worker together with one command.

```bash
# from the project root
cp backend/.env.example backend/.env      # edit SECRET_KEY at minimum
cp frontend/.env.local.example frontend/.env.local

docker-compose up --build
```

Once containers are up, run migrations and seed roles (one-time, or after model changes):

```bash
docker exec -it courier_api mkdir -p alembic/versions
docker exec -it courier_api alembic revision --autogenerate -m "initial tables"
docker exec -it courier_api alembic upgrade head
docker exec -it courier_api python seed_roles.py
```

Now visit:
- **http://localhost:3000** — the Next.js frontend (login/register/dashboard)
- **http://localhost:8000/docs** — FastAPI's interactive Swagger docs

The frontend's `NEXT_PUBLIC_API_URL` points at `http://localhost:8000/api/v1` — this is resolved **in your browser**, not inside Docker's internal network, so it must use the port your host machine sees (`localhost:8000`), not the `api` service name. This is already set correctly in the compose file; just don't change it to `http://api:8000` or the browser won't be able to reach it.

## Getting Started — Backend Only (without Docker)

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

## Getting Started — Frontend Only (without Docker)

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
Requires the backend to already be running and reachable at the URL in `.env.local`.

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
- QR code tracking
- Frontend: staff panel, rider panel, admin panel, public tracking page, refresh-token handling (see `frontend/README.md`)
