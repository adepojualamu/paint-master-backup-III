# Paint Masters — Project Status

_Last updated: 2026-07-15. Supersedes the running notes in `SESSION_SUMMARY.md` for the auto-assignment, CSP, role-gating and production-mode work; the pricing/quote history there still stands._

## TL;DR

The platform is a Node/Express + better-sqlite3 backend serving a static HTML/JS customer site and admin console. Pricing is server-canonical (VAT-inclusive, admin rate-card driven). Recent work: fixed a site-wide dead-button bug caused by a Content-Security-Policy directive; built **automated painter assignment with a dispatcher approval gate**; added **role-based access to the admin console** (so the money sections are finance-only); and flipped the app into **production mode** (demo seed data no longer shows).

---

## Latest (2026-07-15)

### Role-based admin console

The backend already enforced admin sub-roles on the API (`routes/finance.js` requires `finance`; assignment requires `dispatcher`; QA sign-off requires `qa`). The admin UI now mirrors that: `admin/assets/admin-shared.js` carries an `ADMIN_PAGE_ROLES` map, hides sidebar links a sub-role can't use, and blocks direct URL access to restricted pages with an access-denied overlay. The money sections (**Finance, Painter Payouts, Pricing**) are limited to `finance` + `super_admin`; operations to `dispatcher`; QA Reviews to `qa`; account admin (Approvals, Team, Settings) to `super_admin`. An admin with no sub-role set is treated as full-access, mirroring the backend bootstrap so nobody is locked out mid-migration. The sidebar role card now shows the real sub-role. Verified with a 9-case decision-table test against the extracted logic.

### Production mode

Every page now carries `<meta name="pm-mode" content="production">`, which flips `PM_IS_PRODUCTION` on and blanks all demo seed data (painter calendars, admin artisan/customer/job stores, demo logins). A guarded **one-time local purge** in `assets/shared.js` clears the demo data stores that a demo-browsed browser had saved, so production actually starts blank — while preserving the auth token (no forced logout) and branding settings, and never re-running or wiping real entries. Verified with an 8-case test (mode detection, purge, idempotency, demo-mode no-op).

> **Consequence:** the admin list pages (Paint Masters, Customers, Job Board) still read the local store, so they render blank in production until the localStorage→API migration below is done. Frontend demo login shortcuts are off; sign-in goes through the backend.

---

## What we built this session

### 1. Fixed dead buttons across the whole app (CSP)

The quote wizard's "Next" button — and, it turns out, every inline `onclick` handler on ~26 pages — was silently refused by the browser. Root cause: `backend/server.js` configures Helmet with `useDefaults: true` and overrides `script-src`, but Helmet's defaults also set `script-src-attr 'none'`, which blocks inline event-handler attributes even when `script-src` allows `'unsafe-inline'`. jsdom ignores CSP, which is why headless testing never caught it.

Fix: added `'script-src-attr': ["'unsafe-inline'"]` to the CSP. Verified by rendering the emitted header (`script-src-attr 'none'` → `'unsafe-inline'`). The rest of the policy (same-origin-only external scripts, `object-src 'none'`) is unchanged.

### 2. Automated painter assignment with an approval gate

Previously a dispatcher manually picked a painter for every customer booking. Now the flow is:

1. **Booking created** → lands as `pending_assignment` (as before), then the system immediately proposes the best painter and moves it to a new **`pending_approval`** state. The painter is *attached but not notified*.
2. **Dispatcher reviews** the proposal on the Assign Bookings page and either:
   - **Approves** → booking becomes `pending`, the painter is notified and their 2-hour confirmation window starts.
   - **Rejects** → that painter is recorded so they're never re-proposed for this job, and the system proposes the next-best painter; if none is free it falls to the manual queue.
   - **Reassigns** → picks a specific painter directly (skips the gate, notifies immediately, flagged `manual`).
3. **Safety sweep** every 2 minutes re-attempts any booking still sitting unassigned (e.g. once a painter frees up).

**Selection logic.** Among painters who are free for the job's dates and not suspended, it prefers those who offer the job's service, then ranks by fewest active jobs (fair workload distribution), breaking ties by rating. Service match is a *preference, not a hard gate*: if nobody in-specialty is free, it falls back to any free painter and flags the proposal "⚠ Outside usual services" so the dispatcher sees it before approving.

**Files:**

- `backend/db/migrations/032_auto_assignment.sql` — adds `assignment_mode` and `rejected_painter_ids` columns + an approval-queue index (additive; no table rebuild).
- `backend/services/autoAssign.js` — candidate selection, `autoAssignBooking`, `sweepUnassigned`, and the background sweep loop.
- `backend/services/availability.js` — added `excludeBookingId` so a proposal doesn't count as a conflict with itself.
- `backend/routes/bookings.js` — auto-propose on booking creation; new `PUT /:id/approve-assignment` and `PUT /:id/reject-assignment`; `PUT /:id/assign` broadened to reassign proposals; `enrichBooking` now returns `painter_services`.
- `backend/server.js` — starts the sweep worker alongside the notification worker.
- `admin/assign-bookings.html` — two-queue UI: "Awaiting your approval" (approve / reject / reassign, with the out-of-specialty warning) above the manual queue.

**Verification.** A 17-case harness runs the real router over HTTP against a throwaway database (production data untouched): ranking, availability, the self-conflict fix, approve/reject/reassign endpoints, the service-fallback path, a genuine "nobody free" case, the sweep, and the approval guard rails. All pass. Migrations `001`–`032` apply in sequence with a clean integrity check.

> **Operational notes:** run the backend from `backend/` (`cd backend && npm start`) — migration `032` applies on boot. If `better-sqlite3` ever errors with `ERR_DLOPEN_FAILED`, run `npm rebuild better-sqlite3`.

---

## Current architecture (orientation for whoever picks this up)

- **Backend** (`backend/`): Express API, better-sqlite3, migrations in `db/migrations/` (run once on boot), background workers (`notifyWorker`, `autoAssign`) started only when the process serves. Auth is JWT with an admin sub-role system (`dispatcher`, `finance`, `qa`, `super_admin`).
- **Pricing** is server-canonical: an admin-editable rate card (`pricing_settings`) drives `services/pricing.js`; the quote page shows exactly what the customer is charged (VAT-inclusive at 12.5%).
- **Booking lifecycle:** `pending_assignment` → `pending_approval` (auto-proposed) → `pending` (painter to confirm) → `confirmed` → `in_progress` → `qa_pending` → `completed`; `cancelled` is terminal.
- **Frontend** is static HTML per page + a shared `assets/shared.js` (layout, auth widget, pricing mirror) and `admin/assets/admin-shared.js`. No build step; inline handlers are used throughout (relevant to the CSP item below).

---

## Still pending / next logical steps

Ordered roughly by leverage. Items marked _(verified today)_ were checked against the current code, not just carried over from the old handoff.

### High priority

1. ~~**VAT display copy for customers.**~~ **Done (2026-07-15).** The quote and booking pages now show a transparent breakdown — Labour, Materials, Platform fee, **Subtotal (ex. VAT)**, **VAT (12.5%)**, then an emphasized **Total (incl. VAT)** — plus a one-line reassurance ("Prices include 12.5% VAT — the total is exactly what you'll be charged"). Labels are consistent across both pages and the headline totals read "incl. VAT".
2. **Live payment integration testing.** End-to-end Paystack/Hubtel sandbox charge → escrow hold → payout. The plumbing exists (`services/payments.js`, escrow tables) but hasn't been exercised end-to-end against a sandbox.
3. **Drop CSP `'unsafe-inline'` properly.** Today's fix keeps inline handlers working, but the real hardening is to move inline JS/CSS to external files and remove both `'unsafe-inline'` and `'unsafe-inline'` on `script-src-attr`. There are ~171 inline handler usages across the admin pages alone _(verified today)_ — this is a meaningful refactor, best done page-by-page.

### Auto-assignment follow-ups (new this session)

4. ~~**Notify the dispatcher when a proposal lands.**~~ **Done (2026-07-15).** The sidebar "Assign Bookings" link now carries a live badge (`updateAssignBadge` in `admin/assets/admin-shared.js`) showing bookings that need a dispatcher — proposals awaiting approval plus anything unassigned — polled from the API, visible on every admin page. A fuller SMS/email-to-dispatcher channel could still be added later if desired.
5. **Richer matching signals.** _(Capacity cap done, 2026-07-15.)_ Selection uses service + date availability + workload + rating, and now a **per-painter capacity cap** (`MAX_ACTIVE_JOBS` in `services/autoAssign.js`, default 5, override via `AUTO_ASSIGN_MAX_ACTIVE_JOBS`; 0 disables): painters at the cap aren't auto-proposed, though a dispatcher can still assign past it manually. Still open: **location proximity** (painter `city`/`area` vs the free-text job address) and customer-preferred/previously-used painters.
6. ~~**Prune / cap `rejected_painter_ids`.**~~ **Done (2026-07-15).** The reject endpoint now caps the list at the 25 most-recent rejections (`routes/bookings.js`), so it can't grow without bound; a painter rejected long ago can become eligible again, which is fine. Verified with a 5-case test.
7. **Single-instance sweep assumption.** The sweep runs in-process with an overlap guard — correct for one server. If the API is ever scaled horizontally, two instances could double-propose; move the sweep to a leader-elected job or a locked row claim (the notify worker has the same assumption and would need the same treatment).
8. **Reassign after painter confirmation.** `/assign` currently reassigns from `pending_assignment` and `pending_approval`. Reassigning a booking a painter has already *confirmed* (cancelling on them, re-notifying) is a deliberate gap — decide the policy (penalty? notification copy?) before enabling.

### Standing roadmap (from earlier handoffs)

9. ~~**`materials_included` → always-on.**~~ **Done (2026-07-15).** `services/pricing.js` now always includes materials (`includeMats = true`), and the callers were reconciled: `routes/quotes.js` create and `routes/bookings.js` default to true, and the client mirror in `assets/shared.js` always includes them. Real customer charges are unchanged (the customer flow already sent `true`); the previously-inconsistent server default-false paths now match. The separate **painter-profile** `materials_included` in `routes/painters.js` (a painter capability, not the pricing flag) was intentionally left alone. Verified with a 6-case pricing test.
10. **Admin list pages → API.** _(Largely done, 2026-07-15.)_ `admin/assets/admin-shared.js` now has `pmHydrateAdminStoreFromApi()` which, in production, fetches `/api/painters`, `/api/bookings`, and `/api/admin/users?role=customer`, maps them into the store shape and fires `pmStoreReady`; **Paint Masters (`artisans.html`)** and **Customers (`customers.html`)** re-render off it. **Job Board (`jobs.html`)** was already API-driven (its `loadBoard()` uses the API and only falls back to the local store offline). Hydration now **pages through all rows** (`_pmFetchAllPages`, 100/page, bounded at 50 pages), so lists are no longer capped at 100. Remaining follow-ups: the painters list excludes suspended painters (so they won't appear in the admin roster); customer LTV / job counts and artisan utilisation are placeholder values because the API doesn't expose them yet; and the pages' write actions (edit/add/message) still update the local store cache rather than fully round-tripping to the backend.
11. **Payout policy on rate changes.** Payout uses the current `painter_payout_pct` at QA-approve time. Decide whether historical jobs should lock the rate in effect when they were quoted.
12. **Painter mobile day-of-job flow** — milestone photo uploads, in-app QA checklist, navigation.
13. **Production deployment automation** — process supervision, TLS reverse proxy, scheduled volume backups.

### Quick wins

- Confirm the "Next" button in a real browser now that the CSP fix is in (hard-refresh first).
- Delete the deprecated `calcQuote()` in `quote.html` once the new pricing path is trusted.

---

## Suggested next focus

If picking one thing next: **the dispatcher notification (#4)** is the smallest change that makes the auto-assignment feature feel complete end-to-end, and **VAT display copy (#1)** is the highest-risk customer-facing gap. Both are small. After that, **payment sandbox testing (#2)** is the biggest unknown standing between this and a real transaction.
