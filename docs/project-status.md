# Paint Masters — Project Status

A handoff-grade summary of the codebase as it stands: what is built, what
that means for an operator using it today, and what is still on the
roadmap before a real-world launch.

Last reviewed: 2026-06-13.

## Where we are

Paint Masters is a managed-marketplace web app for booking professional
painters in Ghana. It runs as a single Node.js/Express service that
serves both an HTTP API (`/api`) and the static customer + admin
frontend out of the same origin. The data store is SQLite, with file
uploads on local disk; both sit under a single Docker named volume so
the container is the unit of deploy. The app boots, migrates its schema,
seeds a bootstrap admin and a roster of demo painters, and serves
customers, painters and dispatchers — all wired against the real API,
with graceful fallback to demo data when the backend is unreachable.

The platform is shippable for an internal preview or invite-only beta on
its own infrastructure today. The remaining items below are about
trust-building polish, real-money production hardening, and removing the
last localStorage demo bridges.

## What's done

### Notifications pipeline

A real outbox-based notification system. `services/notifications.emit()`
writes rows to `notifications_outbox`; a background worker
(`services/notifyWorker.js`) drains them every 30 seconds with
exponential back-off and a 5-attempt dead-letter queue. Ten lifecycle
events are wired through every route (`booking.created`,
`booking.assigned`, `booking.confirmed`, `booking.cancelled`,
`painter.done`, `qa.approved`, `qa.rejected`, `volume.confirmed`,
`volume.rejected`, `account.welcome`).

The SMS side is a real Hubtel SMSC client (`services/sms.js`) with
timeout, cost tracking, and proper error/retry behaviour. The email side
is a real client for **Resend**, **SendGrid** or **Mailgun**
(`services/email.js`) chosen by an env var. Both senders run in
"record-only" mode when no credentials are set — every queued message
still lands in `sms_log` / `email_log` so an operator can see the audit
trail; flipping to live delivery is just filling in `HUBTEL_CLIENT_ID` +
`HUBTEL_CLIENT_SECRET` and `EMAIL_PROVIDER` + `EMAIL_API_KEY` in `.env`
and restarting the container. `backend/scripts/notify-test.js` exists as
a one-command live-send verifier.

### Quote, booking and payout engine

`services/pricing.js → calculateQuote()` returns a structured breakdown
with discrete `labour_day`, `labour_sqm`, `labour`, `materials`,
`platform_fee` and `total` figures, and persists `labour` on the quote
and the booking via migration 030. The QA-approve handler now pays the
painter `labour × 0.90` instead of the buggy `total × 0.90` — so
materials and the platform's own fee no longer get handed to the
painter. A legacy fallback derives `labour` from `platform_fee` for
rows persisted before the migration.

Customer-supplied `rate_per_day` is no longer trusted: when a quote has
no painter assigned the server uses `DEFAULT_QUOTE_RATE_PER_DAY` from
constants, and when a painter is preassigned the rate comes from
`painter_profiles.rate_per_day`. The body field is accepted (for
schema-compat) but ignored. This closes the obvious anonymous-quote
price-tampering path.

### Customer space photos

A new feature lets customers attach photos of their space as part of
finalizing a quote. Migration 029 created `quote_photos`. The backend
exposes `POST /api/quotes/:id/photos` (multipart, multer-based, up to 8
images at 8 MB each, image MIME only) and a serve endpoint that gates
by the quote id (the same bearer-token model as `GET /api/quotes/:id`).
A hard cap of 8 photos per quote keeps an attacker who knows a quote id
from filling disk. `enrichQuote` includes the photos in the API
response, and `GET /api/bookings/:id` also returns them as
`quote_photos` so the painter side can render them.

The customer adds photos in step 2 of `booking.html` (with preview
thumbnails and remove buttons), and the upload fires best-effort after
the quote POST returns an id. The dispatcher sees a thumbnail strip on
every card in `admin/volume-reviews.html`. The painter's job-detail
popover lazy-loads them on first open via `GET /api/bookings/:id` and
re-renders.

### Job Board (admin/jobs.html) — API-driven

The Job Board pulls live bookings from `GET /api/bookings`, maps booking
statuses straight to kanban columns
(`pending_assignment → painter_assigned → confirmed → in_progress
→ qa_pending → completed`, plus `cancelled`), and wires assign + cancel
to `PUT /:id/assign` and `PUT /:id/cancel`. Operations that the backend
intentionally doesn't expose to admins (free stage moves, soft-delete,
add-job) were dropped — the dispatcher's real path for stage transitions
is the painter and QA workflows, surfaced read-only here. When the API
is unreachable the board falls back to localStorage demo data with an
amber banner. A red sticky alert above the batch bar surfaces the
*exact* API error from a failed assign or cancel (auth, sub-role, 4xx,
5xx) so silent failures are gone.

### Painter dashboard (painter.html) — API-driven

Loads the painter's own bookings on boot (the backend `protect`
middleware auto-scopes to the signed-in painter). Status maps to a
familiar painter UI stage; `pending` bookings carry a `pendingConfirm`
flag and the "Confirm assignment" button calls `PUT /:id/confirm`;
"Mark QA-ready" calls `PUT /:id/complete`. Quote photos lazy-load on
popover open. Demo fallback is preserved for offline / unsigned-in
states with a banner.

### Brand partners

The customer homepage's trusted-partner grid is now derived from a
single source of truth: the `pmBrands` registry in `shared.js`. The
admin tool (`admin/brand-partners.html`) reads, edits, and persists the
same data. Three previously missing logos (Dulux, Berger, Crown) were
generated and shipped. A `bpLogoError()` fallback renders a styled
wordmark when an image is missing, so the page never shows a broken
icon.

### Edit Master / painter profile editing

`PATCH /api/painters/:id` is admin-only and updates a whitelisted set of
profile fields (`city`, `area`, `bio`, `experience_years`,
`rate_per_day`, `materials_included`, `avatar_color`, `services`) plus
the linked `users` row's `name`, `phone`, `email` — wrapped in a single
transaction. `admin/artisans.html` got an "Edit details" button on every
painter detail card that opens a form bound to those fields and fires
the PATCH. The form shows the API error inline if the backend rejects.

### Authentication

`POST /api/auth/login` accepts **phone or email** with the same
password. The login validator enforces a real email format on the email
field but case-insensitively. Bad credentials return 401 with a generic
message ("Incorrect credentials"). Admins seeded on first boot land
with `sub_role = 'super_admin'`, and `requireSubRole` now has a
bootstrap clause: on a system with zero super_admins any admin passes,
so a fresh container can dispatch the moment the operator logs in.

### Quote calculator UX

`quote.html` no longer shows a default total like "GHS 4,465 incl. VAT"
to a customer who hasn't actually specified anything. The summary card
holds a placeholder ("Tell us about your space below to see your quote",
all rows `—`, "Book this quote" disabled) until the customer touches the
form. The same `calcQuote()` then runs against the real inputs. The
summary's Materials line and the paint-volume preview now read from a
single source — when paint products are selected, both display the
bucket-based real cost; without products the summary marks the line as
an estimate via a tooltip.

### Security

Critical, High and Medium tier fixes are in.

- The `JWT_SECRET` fallback to a hardcoded value is gone. Both the auth
  middleware and the auth routes read `config.jwt.secret`, which throws
  at boot if unset.
- CORS now honours the `CORS_ORIGINS` allowlist via the
  `config/cors.js` helper. The previous wide-open `cors()` is gone.
- Helmet's CSP is back on with `script-src 'self' 'unsafe-inline'` plus
  a Google Fonts allowlist — inline scripts still run, but a successful
  HTML injection can't load `<script src=https://evil/x.js>`. HSTS is
  set to 1 year, `includeSubDomains`, `preload`.
- A production-only HTTPS-or-bust gate sits in front of every other
  middleware: HTTP GET/HEAD get a 301 to `https://`, anything that
  could carry credentials gets a 403. `trust proxy: 1` makes the gate
  work behind a TLS-terminating reverse proxy.
- `routes/admin-users.js` reset-password no longer echoes the temp
  password in the response — it dispatches via SMS to the user's phone
  and the response just reports the SMS status.
- Hubtel webhook authenticity (`services/payments.parseCallback`) was
  already implemented with HMAC-SHA256 + `crypto.timingSafeEqual`;
  documented in the security notes.

The full set of decisions and the gaps that remain are in
`docs/security-notes.md`.

### Docker shipping

`Dockerfile`, `docker-compose.yml`, `.dockerignore` and `.env.example`
ship the platform as a single self-contained container based on
`node:22-bookworm-slim`. The macOS-specific `better-sqlite3` binary
problem the project ran into during dev is side-stepped by the fact that
`npm ci` inside the Linux container rebuilds against the right
prebuilt. A named volume (`paintmasters-data`) holds the SQLite database
and the upload directory so data survives container rebuilds. The
Windows-friendly runbook is in `docs/docker.md`.

### Documentation produced

- `docs/business-logic.md` — platform model, money split with a worked
  example, job lifecycle, customer photos.
- `docs/security-notes.md` — JWT-in-localStorage tradeoff, quote-as-
  bearer-token model, CSP tradeoffs, transit security (HTTPS gate, HSTS,
  webhook HMAC, outgoing-provider audit), and the gaps still open.
- `docs/docker.md` — Windows / Docker Desktop runbook.
- `docs/project-status.md` — this document.

## What's NOT yet done

In rough priority order.

**Pricing reconciliation between the client and the server.** The
customer-facing quote shown in `quote.html` is computed client-side with
a multiplier model (`surface × finish × tier × scope × condition`),
while the server stores its own number from `services/pricing.js`. The
materials line was reconciled in this last pass; labour and the grand
total still drift. The server number is what the customer ultimately
pays, so the worst case today is a customer surprised by the price on
their bill. Closing this means picking one model and porting the other
to it. Worth doing before opening to real customers.

**`materials_included` becoming non-optional.** The spec says materials
are always platform-supplied, but the quote API still accepts an
`materials_included` flag that toggles a materials line on or off.
Should be collapsed to always-on once the pricing reconciliation lands.

**The painter self-signup path (`register.html`).** It still writes to
`localStorage`, not to the backend `POST /api/auth/register`. A painter
who registers on a fresh container can't sign in until an admin manually
creates them in the backend. Re-wiring `register.html` to the API closes
the gap.

**The admin Customers and Artisans rosters are still demo-data lists.**
The detail card's Edit form on `admin/artisans.html` is wired to the
real `PATCH /api/painters/:id` endpoint, but the *list view* still
reads `localStorage` seed data. Migrating both pages the way `jobs.html`
and `painter.html` were is the remaining work for closing the demo
bridges roadmap item.

**Live payment integration testing.** `services/payments.js` has the
real Hubtel Receive Money client and the webhook handler verifies HMAC
correctly. What's not done is an end-to-end live test against the
sandbox: setting `HUBTEL_MERCHANT_ACCOUNT`, `HUBTEL_CALLBACK_SECRET` and
`HUBTEL_CALLBACK_URL` in `.env`, pushing the container behind a
reachable URL, and driving a real MoMo charge through to escrow.

**Analytics page integration.** `admin/analytics.html` reads the
localStorage seed store. The backend has `services/analytics.js` with a
real funnel / top-painter / rating-breakdown query layer; the page
needs to be migrated to it the same way `jobs.html` was.

**CSP without `'unsafe-inline'`.** Every HTML file ships heavy inline
`<style>` and `<script>` blocks. The current CSP allows them. The path
off is to move the inline JS/CSS into external files, then drop
`'unsafe-inline'` from `script-src` and `style-src`. A meaningful
refactor; not urgent while the rest of the stack settles.

**Painter mobile day-of-job flow.** Photo milestone uploads from the
site, an in-app QA checklist, in-app navigation to the job address —
all standard features for a marketplace painter app, all still to do.

**Production deployment automation.** PM2 / systemd for process
supervision, an nginx or Caddy reverse proxy in front of the container
for TLS and the HSTS gate, and a scheduled backup of the named
volume (`docker run --rm -v paintmasters-data:/data -v $(pwd):/backup
alpine tar czf …`). The Docker container is the unit; the orchestration
around it is operator work.

## How to run it

The Docker quickstart is in `docs/docker.md`. The short version:

```
cp .env.example .env
docker run --rm node:22-bookworm-slim node -e \
  "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# paste the output into .env as JWT_SECRET=...
docker compose up -d --build
```

Then open `http://localhost:3000`. Seeded credentials for the bootstrap
admin: `0244000000 / password123`. Seeded painters: `0244100001`
through `0244100008`, same password. The database, uploads, and any
data written via the API persist in the `paintmasters-data` named
volume across container rebuilds.

For real production deploys: put a TLS-terminating proxy in front, set
`CORS_ORIGINS`, fill the Hubtel + email provider credentials in `.env`,
and consult the production checklist in `docs/docker.md`.
