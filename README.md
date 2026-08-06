# Paint Masters

Ghana's first professional painting agency, built as a single platform that covers the customer-facing site, the dispatcher's admin console, the Paint Master's mobile-friendly dashboard, and the backend API behind all three.

The product turns a fragmented painter-finding experience into a one-tap booking with an instant quote, a certified Paint Master who shows up on schedule, escrow-protected payments via Hubtel, and a 12-month finish warranty on every job.

---

## What's in the repo

Four surfaces share one codebase:

- **Customer site** at `/` — homepage, paints catalogue, per-brand landing pages with a curated colour palette, instant-quote flow, booking, signed-in member dashboard, and a live project tracker for any active job.
- **Admin console** at `/admin/` — kanban job board, painter roster with availability calendars, customer 360, inventory + suppliers, analytics, approvals, support tickets, and live activity bus.
- **Paint Master dashboard** at `/painter.html` — today's assignment with check-in/QA actions, 28-day calendar, upcoming jobs, earnings preview (locked to the Phase 1 escrow split), and an in-panel notification feed.
- **Backend API** at `/api/*` — Express + better-sqlite3 + JWT, twenty migrations covering bookings/quotes/contracts/milestones/payments/inventory/photos/audit/refunds/notifications-outbox/feature flags/devices/rate limits/escrow holds/idempotency keys.

A single `pmActivity` cross-tab event bus connects the three frontends — when a customer flags a concern, the admin's notification bell ticks up; when the admin dispatches a job to a painter, the painter's notifications panel updates immediately.

---

## Tech stack

Frontend is plain HTML/CSS/JS — no framework, no build step. Loads in any browser, hosts on any static service, edits in any editor. The shared design tokens live in `assets/styles.css`. State that needs to survive a refresh sits in `localStorage` keyed under `pm_*`, with a documented catalogue and a one-click wipe in admin Settings.

Backend is Node.js (≥ 20) with Express 4, better-sqlite3 (version 11, Node 24-compatible), JWT auth, express-validator, helmet, and express-rate-limit. SQLite is the storage layer for everything; migrations are flat `.sql` files and run idempotently on boot. Hubtel is the chosen rail for SMS (and, in Phase 1, MoMo + card + bank inbound payments).

Phase 1 of the payment integration is shipped: charge endpoint, signed callback handler, idempotency middleware, escrow_holds + warranty_ledger tables, and a stub mode that lets local development work without real Hubtel keys. Phase 2 (painter payouts via Send Money, monthly payroll with PAYE+SSNIT, escrow release job) is planned in `backend/docs/PAYMENTS.md`.

---

## Quick start

Three commands once you have Node 20+ installed:

```bash
cd backend
npm install
npm run db:migrate
npm start
```

Then open `http://localhost:3000/` for the customer site, `/admin/` for the dispatcher console, or `/painter.html` (after signing in as a painter) for the Master dashboard.

For the full step-by-step (Windows + Mac, including a fresh-machine path), see `LOCAL_SETUP.md`.

For the production deployment path (env vars, systemd, nginx, Hubtel webhook, the production-mode flag), see `DEPLOYMENT.md`.

---

## Demo credentials

These work in `demo` mode (the default). Flipping the `<meta name="pm-mode" content="production">` tag in each HTML head disables the local fallback so only the real backend can sign anyone in.

| Role     | Phone        | Password    | Lands on             |
|----------|--------------|-------------|----------------------|
| Admin    | 0244000000   | password123 | `/admin/`            |
| Customer | 0244200001   | password123 | `/my.html`           |
| Painter  | 0244300001   | password123 | `/painter.html`      |

---

## Repository layout

```
.
├── README.md                  ← you are here
├── LOCAL_SETUP.md             ← run on your laptop in 15 minutes
├── DEPLOYMENT.md              ← host it online (env vars, systemd, nginx, DNS)
│
├── index.html                 ← customer homepage
├── about.html services.html   ← top-of-funnel content
├── paints.html brand.html     ← paint catalogue + per-brand landing pages
├── artisans.html              ← public Paint Masters directory
├── booking.html quote.html    ← booking + instant-quote flow
├── login.html register.html   ← sign-in (role-aware redirect)
├── change-password.html       ← forced first-sign-in rotation
├── my.html                    ← customer dashboard (bookings + warranties)
├── track.html                 ← live project tracker (chat + photos + actions)
├── painter.html               ← Paint Master dashboard
├── warranty.html              ← downloadable 12-month warranty certificate
│
├── assets/
│   ├── styles.css             ← shared design tokens + components
│   ├── shared.js              ← pmAuth, pmRegions, pmBrands, pmComms,
│   │                            pmActivity, pmReviews, PM_MODE, nav/footer
│   └── paint-catalog.js       ← PM_PAINTS + brand-partner card renderer
│
├── admin/
│   ├── index.html             ← dispatcher dashboard (KPIs + live activity)
│   ├── jobs.html              ← kanban with stage filters + soft-delete
│   ├── artisans.html          ← painter roster with availability + actions
│   ├── customers.html         ← 360-view + per-row New booking / Message
│   ├── inventory.html         ← SKU + supplier management
│   ├── analytics.html         ← team-wide metrics
│   ├── approvals.html         ← painter / contract approvals
│   ├── support.html           ← FAQ + ticket form (channel-aware)
│   ├── team.html settings.html
│   └── assets/
│       ├── admin.css
│       └── admin-shared.js    ← admin shell, store, search, bell, helpers
│
└── backend/
    ├── server.js              ← entry point (boots Express + serves frontend)
    ├── package.json
    ├── config/                ← env loader + business constants
    ├── db/
    │   ├── index.js migrate.js seed.js
    │   └── migrations/        ← 001-020 (.sql)
    ├── middleware/            ← auth, validate, error, idempotency, ...
    ├── routes/                ← auth, painters, bookings, reviews, payments
    ├── services/              ← payments (Hubtel), pricing, sms, email, ...
    ├── utils/                 ← errors, ids, money (pesewas), dates, logger
    ├── scripts/               ← reset-db, smoke-test, create-admin
    └── docs/
        ├── PAYMENTS.md        ← payment-integration plan + Phase 1 status
        └── SCALING.md         ← capacity / read-replica notes
```

---

## Feature highlights

### Customer side

Instant quote that already wires the canonical pricing engine. Per-brand landing pages with a curated colour palette and a tap-to-copy hex / use-in-quote modal. Live project tracker with a multi-party chat (party badges for customer / painter / dispatcher / admin / system), an in-page photo upload module, and four wired action buttons: Request a specific photo, Change scope, Leave a review, Report a concern. The cashless-policy disclaimer is sourced from a single constant and surfaced in the footer, the booking payment step, and the tracker sidebar — plus a one-tap Report-a-cash-request button that pulls the painter from the roster pending review. Channel-aware chat composer routes the customer's message via in-platform / SMS / WhatsApp.

### Admin console

Real-time activity bus with a notification bell in the topbar (cross-tab unread counter) and a Live activity panel on the dashboard. Job board with stage filter chips, hide-empty toggle, compact-card density, soft-delete with typed-confirmation and restore from a "Show deleted" view, and an Add Job modal with start-date + duration + auto-computed end-date. Painter roster modal with channel-aware Message Master, View full calendar, Assign new job, and Toggle availability. Customer detail with per-row New booking (pre-fills the customer-side flow) and Message (channel picker), plus top-level Add Customer and Export CSV. Inventory with Add SKU modal that reuses existing categories/suppliers and supports new ones inline. Settings has a Data tab cataloguing every `pm_*` localStorage key with byte counts and a one-click "Reset to clean production state" wizard.

### Paint Master dashboard

Today's assignment card with check-in / mark-QA-ready actions. 28-day calendar driven by the same component admin uses, with click-into-job popovers showing start/end dates and stage-aware quick actions. Next-five upcoming list. Earnings card driven by the locked Phase 1 split (90% net, 5% warranty hold, 95% of net released after holdback). Notifications panel that filters the cross-tab activity bus to events targeted at this painter, enriched with a mini job card for any event that references a booking ref.

### Backend (Phase 1 shipped)

Twenty migrations cover the entire data model. JWT auth with a forced first-sign-in password rotation flow. Hubtel-pivoted payments service (Receive Money for MoMo + cards + bank, with HMAC-SHA256 callback verification and a stub mode for dev). Idempotency middleware backed by a real table so client retries and Hubtel callback re-deliveries never double-charge. Escrow holds + warranty ledger tables enforce the locked decisions: 7-day holdback after QA pass, 5% per-painter visible warranty reserve. AppError-aware global error handler so route-thrown errors get the right HTTP status. Static-file middleware serves the frontend out of the project root so the backend can host both halves on the same origin.

---

## Documentation index

- `LOCAL_SETUP.md` — laptop walkthrough (Windows + Mac), 15 minutes end-to-end.
- `DEPLOYMENT.md` — pre-launch checklist, env vars, systemd unit, nginx config, Hubtel webhook, day-2 ops.
- `backend/README.md` — backend-only reference (API endpoints, scripts).
- `backend/docs/PAYMENTS.md` — payment-integration plan, locked decisions, Phase 1 deliverables, Phase 2 roadmap.
- `backend/docs/SCALING.md` — capacity notes for the future.

---

## Status

What's shipped and demo-ready:

- Customer site, admin console, painter dashboard, backend API — all wired together.
- Hubtel payments Phase 1: charge, callback (signed), escrow holds, idempotency, stub mode.
- Cross-tab activity bus connecting the three frontends.
- Channel-aware messaging (in-platform / SMS / WhatsApp / email).
- Downloadable 12-month warranty certificate (print-to-PDF).
- Production-mode flag and one-click data wipe for the launch transition.

What's planned for the next sprint:

- Hubtel Phase 2 — QA-pass route, painter earnings ledger, monthly payroll with PAYE+SSNIT, Send Money disbursement.
- Real notifications-outbox worker — replaces the `pmComms` deep-link handoff with server-side delivery.
- Email integration (Resend / SendGrid) — currently a stub.
- File uploads to S3 / R2 — currently localStorage data URLs.
- Per-brand landing-page customisation in admin (currently the brand registry is code, not data).

---

## Licence

Internal — all rights reserved by Paint Masters Ghana. Don't redistribute without written permission.
