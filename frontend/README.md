# FastEx Courier — Frontend (Next.js)

Customer-facing web app for FastEx, built with Next.js 14 (App Router) + TypeScript + Tailwind CSS. Visual theme (navy/orange, Poppins + Inter, split-screen hero cards) is carried over directly from the provided login/signup HTML mockups.

## What's included in this first pass

- **`/login`** — email + password login, wired to `POST /api/v1/auth/login`
- **`/register`** — registration → phone OTP verification, wired to `POST /api/v1/auth/register`, `/auth/send-otp`, `/auth/verify-otp`
- **`/dashboard`** — customer panel: book a shipment (`POST /customer/orders`), view order history (`GET /customer/orders`)
- Auth token stored via React Context + localStorage (`context/AuthContext.tsx`)
- Typed API client (`lib/api.ts`) matching your FastAPI backend's actual request/response shapes

## Not yet built (next steps)

- Staff panel (walk-in booking UI)
- Rider panel (delivery list + status updates)
- Admin panel (order oversight, rider assignment)
- Public tracking page (`/track/[trackingNumber]`) — backend endpoint already exists (`GET /tracking/{tracking_number}`), just needs a page
- Password reset flow
- Refresh-token handling (currently only stores the access token; add silent refresh via `POST /auth/refresh` before it expires)

## Getting Started

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` if your backend isn't running on the default `http://localhost:8000`.

### 3. Run the dev server

```bash
npm run dev
```

Visit **http://localhost:3000** — you'll be redirected to `/login` (or `/dashboard` if already logged in).

### 4. Make sure your backend is running first

This frontend expects your FastAPI backend (see `../backend/`) to be running and reachable at the URL in `NEXT_PUBLIC_API_URL`, with migrations applied and roles seeded — otherwise registration/login will fail with connection errors in the browser console.

## Project structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout, loads Poppins + Inter
│   ├── page.tsx            # Redirects to /login or /dashboard
│   ├── login/page.tsx
│   ├── register/page.tsx   # Includes OTP verification step
│   └── dashboard/page.tsx  # Book + view orders
├── components/
│   ├── HeroPanel.tsx        # Shared split-screen hero (login/register)
│   ├── Logo.tsx
│   ├── Field.tsx            # Icon input with error state
│   └── OtpBoxes.tsx         # 6-digit OTP input
├── context/
│   └── AuthContext.tsx      # Token storage + auth state
├── lib/
│   └── api.ts               # Typed fetch client for the FastAPI backend
└── tailwind.config.js       # Brand tokens (navy/orange/etc.)
```

## Design tokens (from the FastEx theme)

| Token | Value |
|---|---|
| `navy` | `#0F2648` |
| `navy-light` | `#173868` |
| `orange` | `#F2701A` |
| `orange-light` | `#FF8A3D` |
| `ink` (text) | `#16233D` |
| `muted` (secondary text) | `#6B7686` |
| `line` (borders) | `#E4E8F0` |
| `page` (background) | `#F3F5F9` |
| Display font | Poppins (600/700/800) |
| Body font | Inter (400–700) |

Use these Tailwind classes directly — e.g. `bg-navy`, `text-orange`, `font-display`, `rounded-card`, `shadow-card` — rather than hardcoding hex values, so the whole app stays consistent as you build out more panels.
