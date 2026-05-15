# Payments — module listing & integration plan

This document inventories every payment-related module Paint Masters needs, what already exists, and how to phase the build. It's the answer to "first list the modules, then we discuss implementation" — read it through once, then we pick which modules to wire up first.

The structure is **inbound** (money coming in from customers), **outbound** (money going out to painters and refunds), and **ops** (reconciliation, receipts, audit). Each module names a concrete file in `backend/services/` or `backend/routes/` and the migration that backs it, so we can talk about specific code instead of abstractions.

---

## Locked decisions (2026-05-01)

These are settled and the rest of the document reads against them:

- **Primary rail: Hubtel.** Single Ghanaian vendor, already integrated for SMS in `services/sms.js`, supports MoMo (MTN / Telecel / AirtelTigo) + cards + bank transfer through one API. Paystack stays out of scope unless Hubtel proves unreliable.
- **Strictly cashless.** No cash-on-completion path. The platform never holds physical money, the escrow guarantee always applies, and the painter is paid via payroll only after QA + holdback. The "cash" channel is removed from the module list below — if a customer can't pay digitally, the booking doesn't happen.

  Policy enforcement is layered: (a) a customer-facing **cashless disclaimer** appears in three surfaces — site footer (every page), booking payment step, and the live project tracker sidebar — sourced from a single `PM_CASHLESS_NOTICE` constant in `assets/shared.js`; (b) the project tracker exposes a one-tap **Report a cash request** button that flags the booking, alerts dispatch, and removes the Master from the roster pending review; (c) the painter-side onboarding (register form + Academy contract) explicitly forbids accepting cash, with termination as the consequence. This combination makes "cashless" a real policy, not just a default.
- **Painters are contractors on commission.** _(Updated — was "PAYE+SSNIT employees" in the original Phase-1 plan.)_ Each painter is paid a per-job commission of **90% of net** (after the platform fee), released after the 7-day holdback. **No PAYE / SSNIT** is deducted at source — painters file their own income tax. **WHT on professional services applies** at 7.5% per the GRA Act 896 schedule for contractors; we deduct it from each commission and remit monthly to GRA on the painter's behalf. Per-painter commission overrides (e.g. 85% for new joiners during their probation period, 92% for senior masters) are settable in the artisan modal — the default is 90%.
- **Platform fee: 10%.** Of every paid booking, 10% goes to the platform; 90% accrues to the assigned painter's commission ledger as the per-job commission baseline. The 1.95% Hubtel fee on cards (and ~0.8% on MoMo) is absorbed by the platform — customer pays exactly what the quote says.
- **Holdback period: 7 days after QA pass.** When the QA team marks a job passed, the painter's earnings ledger is credited 7 calendar days later. Aligns with most card-network chargeback timelines and gives a customer who notices a defect within a week the chance to trigger a redo before the money has moved. 48 hours leaves too much chargeback exposure (most paint defects only surface after 3–7 days of curing); 14 days starts to feel like a slow payer and pushes painters back toward asking for cash on the side, undermining the cashless policy. Implementation: `escrow_holds.holdback_until = qa_passed_at + 7 days`. Configurable in admin Settings → Pricing for future tuning.
- **Warranty reserve: 5% of net, per-painter, visible.** Every paid booking posts 5% of the painter's net (after platform fee) to a per-painter `warranty_ledger` row. Funds 30/60/90-day callbacks (touch-ups, drip fixes) without eating platform margin. Released back to the painter at 90 days if no warranty claim has drawn against it. Visible in the painter dashboard so it reads as "your money held back" rather than a hidden fee — invisible reserves consistently kill contractor morale on platforms like this. So for a GHS 1,000 booking: 100 to platform fee, 45 to warranty reserve (5% of 900 net), 855 to painter earnings now. Calibration after 6 months of real claim data.

---

## What we have today

The skeleton is more complete than it looks:

- **Tables:** `payments`, `payment_events`, `refunds`, `audit_log`, `sms_log`, `email_log`. Schemas in `backend/db/migrations/005_payments.sql` and `017_*` (refunds).
- **Services (stubs with stable interfaces):** `payments.js` (Paystack init / verify / webhook signature), `refunds.js`, `notifications.js`, `audit.js`, `email.js`, `sms.js`.
- **Money utilities:** `utils/money.js` with `toPesewas()` (Ghana cedis convert to integer pesewas — 1 GHS = 100 pesewas — to avoid float arithmetic on currency).
- **Reference generator:** `utils/ids.paymentRef()` produces our internal `PAY-XXXX` references.
- **Quote engine:** `services/pricing.js` already includes a 12.5% VAT line and a travel surcharge slot (now hooked to the `pmRegions` registry from the last sprint).

So the work below is mostly filling in real HTTP calls, building webhook routes, and making bookkeeping decisions — not designing schemas.

---

## Inbound modules — money in

### 1. Hubtel inbound (cards + MoMo + bank, single rail)
**File:** `backend/services/payments.js` (pivot from Paystack stub to Hubtel) + `backend/routes/payments.js` (new) + webhook handler.

Customer flow: customer confirms booking, hits "Pay", we call Hubtel's Receive Money endpoint (`POST /v2/pos/onlinecheckout/initiate` for hosted checkout, or `POST /merchantaccount/merchants/{merchant}/receive/mobilemoney` for direct MoMo prompt), pass the booking ID in `ClientReference`, redirect to checkout, Hubtel pings our webhook on success, we mark the booking paid and release dispatch.

What needs building: the Hubtel API client (basic-auth using `HUBTEL_CLIENT_ID` / `HUBTEL_CLIENT_SECRET`), the initialise endpoint, the verify endpoint (`GET /transactions/{transactionId}/status`), the webhook route at `POST /api/payments/webhook/hubtel` with signature verification, idempotency on `ClientReference` (a webhook can fire twice), and the redirect-callback page.

Fees: ~1.95% on cards, ~0.8% on MoMo (mobile money), bank transfer flat. Absorbed by the 10% platform margin.

### 2. Direct mobile-money charge (no checkout redirect)
**File:** Same `services/payments.js`, `chargeMobileMoney()` method.

For "express checkout" — instead of redirecting to a Hubtel-hosted page, we send the MoMo USSD prompt directly to the customer's phone. Customer enters their MoMo PIN on the prompt, we get a webhook with the result. Reduces conversion friction by ~30% on mobile (no page-redirect dance) and is the right default for the MoMo-heavy Ghanaian market.

Hubtel's `/receive/mobilemoney` endpoint takes phone, channel (mtn-gh / vodafone-gh / tigo-gh), amount, and a callback URL. Booking page just collects MoMo number, the rest happens via webhook.

### 3. Bank transfer (auto-reconciled via virtual accounts)
**File:** `backend/services/payments-bank.js` (new) + reconciliation job in `backend/scripts/reconcile.js`.

For B2B / large estate jobs that won't go through MoMo or card. Hubtel supports per-booking virtual account numbers via their Receive Money API — every booking gets its own dedicated account number that the customer wires to. When the wire arrives, Hubtel sends us a webhook tied to that booking, no manual matching needed.

If virtual accounts aren't available on the chosen Hubtel tier, fallback is admin-marks-paid after seeing the wire on the bank statement, with a structured CSV upload tool to bulk-reconcile.

### 4. Escrow holdback (bookkeeping, not a rail)
**File:** `backend/services/escrow.js` (new) + new migration for `escrow_holds` table.

Funds collected via Hubtel sit in the merchant account until QA inspection passes + the holdback window expires. The platform releases the painter's share to the **earnings ledger** (not a direct payout — see employee payroll module 16 below) only after QA pass + holdback. This is the single most important business protection.

Migration to add: `escrow_holds (booking_id, amount_pesewas, status, qa_passed_at, released_at, refunded_at)`. Status enum: `held | released | refunded | disputed`.

The holdback period is **still an open decision** — see the open-decisions list at the bottom.

---

## Outbound modules — money out

### 5. Painter earnings ledger (per-job accrual)
**File:** `backend/services/earnings.js` (new) + new migration for `earnings` table.

When a booking's escrow holdback releases, the painter's 90% share **does not get paid out immediately** — it's posted as a credit to that painter's earnings ledger. Each row: `(painter_id, booking_id, gross_amount, platform_fee, net_amount, accrued_at, paid_in_payroll_id)`.

Why this layer exists: employees are paid monthly via payroll, not per-job. The earnings ledger is the bridge between "this booking is done" and "this painter's monthly cheque". It also doubles as the source for the painter's "earnings to date" view in the painter dashboard, and as the input to the monthly payroll run.

### 6. Monthly payroll (employee model)
**File:** `backend/services/payroll.js` (new) + new migration for `payroll_runs` and `payslips` tables.

End of each month (configurable date — typical Ghanaian SMEs run on the 25th to give time for net pay to land before month-end), an admin clicks "Run payroll for April". The system:

1. Sums each painter's earnings ledger for the period.
2. Adds any base salary (currently zero — painters are paid per-job — but the schema reserves the column for future hybrid models).
3. Computes statutory deductions: PAYE (graduated brackets, currently up to 35% on the top tranche per the GRA Act), SSNIT employee contribution (5.5%), and any voluntary deductions (loans, tools advances).
4. Adds employer SSNIT (13%) as a cost line — paid to SSNIT but not deducted from the painter's gross.
5. Produces a payslip per painter (gross, deductions itemised, net pay) and queues an outbound transfer for the net amount.
6. Marks every earnings-ledger row in the period as `paid_in_payroll_id = <run_id>` so they don't get included again.

What needs building: PAYE calculator (a simple bracket function over Ghana's GRA tables — these change yearly so isolate them), SSNIT calculator, the payroll-run state machine (`draft → reviewed → approved → executed`), payslip PDF generator (reuses the receipts module), and the admin UI for running and reviewing payroll. Backend route: `POST /api/admin/payroll/runs`.

### 7. Net-pay disbursement via Hubtel Send Money
**File:** Same `services/payroll.js`, `disburseRun()` method, calls Hubtel Send Money API.

Hubtel's Send Money endpoint pushes funds to a MoMo wallet or bank account. We loop the approved payroll run, send each painter their net pay, store the Hubtel transfer reference back on the payslip, retry failures, and mark the run `executed` only when every disbursement has either succeeded or been manually written off.

What needs building: the Hubtel Send Money client wrapper, retry queue, audit trail per transfer, manual-write-off path for stuck transfers (rare but real).

### 8. Refunds
**File:** `backend/services/refunds.js` (already stubbed) + `backend/routes/refunds.js`.

Three flavors: (a) full refund before dispatch — reverses the original Hubtel charge; (b) partial refund after partial work — reverses a percentage; (c) refund-and-redo — full refund plus a re-booking flag so the painter doesn't get double-credited on the redo.

The 12-month finish warranty needs a fourth path: free re-do, no money moves to the customer, but the **warranty reserve fund** decrements (see open decision 6 below). The painter assigned to the redo earns from the reserve, not the booking — keeping the warranty cost on the platform's books, not the painter's.

### 9. Chargebacks
**File:** Webhook handler in `routes/payments.js`.

Hubtel notifies us of chargebacks via webhook. We mark the payment as charged-back, freeze any unreleased escrow on that booking, and surface the dispute in admin for evidence submission. Painter earnings already accrued on a charged-back booking are clawed back from the next payroll run (or, if the painter has already been paid, recorded as a salary advance that the next month's earnings net against).

---

## Bookkeeping & operations modules

### 10. Webhook handler
**File:** `backend/routes/payments.js` — `POST /api/payments/webhook/hubtel`.

Every event lands in `payment_events` first — raw body + signature — before we try to interpret it. That way a malformed event from Hubtel doesn't crash the booking flow; we have the full payload for forensics. Idempotency key: Hubtel's event ID, stored unique.

### 11. Idempotency
**File:** `backend/middleware/idempotency.js` (new).

Webhook handlers and customer-initiated charges both need idempotency. For customer charges: client sends `Idempotency-Key` header on the initialise call, we store the result keyed against that header for 24 hours. For webhooks: Hubtel's event ID is the key. Without this, a re-delivered webhook can double-credit a booking.

### 12. Reconciliation
**File:** `backend/scripts/reconcile.js` (new) + admin Reports → Reconciliation pane.

Daily job: pull Hubtel's transaction list for the prior day, match against our `payments` table, surface discrepancies. Common issues: late-arriving webhooks (transaction succeeded with Hubtel but our `payments` row is still `pending`), partial refunds that didn't echo back to us, settlement timing (Hubtel typically settles to the merchant bank account T+1 for cards, T+0 for MoMo).

### 13. Receipts
**File:** `backend/services/receipts.js` (new).

PDF receipt generated server-side after a successful payment, attached to the receipt email (`services/email.js`). Includes VAT breakdown, booking ref, painter, line items, business TIN. Same renderer can produce the warranty certificate and the monthly payslip. Use `pdfkit` or HTML → headless-chromium.

### 14. VAT compliance
**File:** `backend/services/tax.js` (new).

Quote engine already adds 12.5% VAT (NHIL+GETFund actually push the effective rate to ~15% — confirm before launch). What needs adding: (a) GRA-compliant VAT invoice format with the customer's TIN if available; (b) monthly VAT return CSV — sums output VAT collected and input VAT paid (on materials), filed against the GRA portal; (c) handling of the 1% Covid-19 health levy and the GETFund (2.5%) and NHIL (2.5%) lines that ride alongside VAT (12.5%). All of these go on every receipt and can be summed monthly.

### 15. PAYE calculator (employee income tax)
**File:** `backend/services/tax.js`, `paye()` method, with the GRA tables in `backend/config/tax-tables.js`.

Ghana's PAYE is a graduated bracket system on monthly income. The 2026 brackets need to be in a single config file (one update a year, with the budget). The calculator takes monthly gross, applies the brackets in order, returns the tax due. Used by the payroll module.

### 16. SSNIT calculator
**File:** Same `tax.js`, `ssnit()` method.

Ghana's Social Security and National Insurance Trust: 5.5% deducted from the painter's gross (employee), 13% paid by Paint Masters on top (employer). Both go to SSNIT monthly. The calculator returns both numbers; payroll uses the employee portion as a deduction and the employer portion as a cost line.

### 17. Failed-payment retries
**File:** `backend/scripts/retry-failed.js` (new).

A nightly job that takes payments stuck in `pending` for >2 hours (customer abandoned the MoMo prompt or never completed the redirect), marks them `abandoned`, frees the booking slot. Optionally sends a reminder SMS with a fresh checkout link — same SMS module already in `services/sms.js`.

### 18. Audit trail
**File:** `backend/services/audit.js` (already stubbed).

Every payment state change writes to `audit_log` with `(actor_id, actor_type, target_table, target_id, action, before, after, ts)`. Non-negotiable for any money flow — when there's a dispute, the audit log is the source of truth.

### 19. Admin dashboard widgets
**File:** Add panes to `admin/index.html` and `admin/analytics.html`.

Today's revenue, week-to-date, month-to-date. Outstanding holdbacks (escrow), pending payroll obligations, failed payments, refund queue, this-month's PAYE+SSNIT liability. Single-screen ops view so the dispatcher can spot a stuck transaction at a glance.

### 20. Settings & policy
**File:** Extend `admin/settings.html` Pricing tab + a new Payroll tab.

Pricing tab already has platform fee (10%, locked), materials per sqm, refund window. Needs to add: Hubtel client ID + secret references (warning if unset), holdback period in hours, VAT rate (currently 12.5% — may need to be adjusted to compose with NHIL/GETFund), warranty reserve %.

New Payroll tab: payroll run date, default working hours, statutory deduction rates (read-only — sourced from `tax-tables.js`), advance-loan policy, pay periods.

---

## Phased recommendation (Hubtel + employee model)

**Phase 1 — Take real money in (~2 weeks engineering).** Hubtel inbound — direct MoMo charge as primary, hosted checkout as fallback for cards/bank. Webhook handler with signature verification. Idempotency middleware. Escrow holdback bookkeeping. PDF receipts emailed automatically. Admin dashboard widget for today's revenue and outstanding holdbacks. After this phase you can take real money and run a closed pilot — no painter payouts yet, just collection.

**Phase 2 — Pay the painters (~2 weeks).** Painter earnings ledger (each paid booking accrues to the painter). Monthly payroll run with PAYE + SSNIT calculators. Hubtel Send Money disbursement of net pay. Payslip PDFs emailed/SMS'd to painters. After this phase you can pay everyone correctly at month-end.

**Phase 3 — Operational completeness (~2 weeks).** Refund engine (full + partial + warranty redo). Reconciliation script and admin report. Failed-payment retries. Chargeback handling. Warranty reserve ledger. After this phase one person can run support and finance without writing SQL.

**Phase 4 — Compliance polish (~1 week).** GRA-compliant VAT invoice format. Monthly VAT return CSV. NHIL/GETFund/COVID-levy line items if confirmed required. SSNIT monthly remittance helper. Audit dashboard with searchable history. After this phase you can hand the books to an accountant without apology.

**Later (data-driven).** Direct MTN MoMo if Hubtel's MoMo fee starts to bite at volume. Multi-currency. Hybrid pay model (base salary + per-job bonus) if the team grows beyond pure piece-rate.

---

## Phase 1 — concrete deliverables (this PR)

All decisions above are now locked. Phase 1 ships these files:

1. **`db/migrations/019_escrow_holds.sql`** — three things in one migration:
   - `escrow_holds` table: per-booking record with `payment_id`, `gross_pesewas`, `platform_fee_pesewas`, `net_pesewas`, `warranty_reserve_pesewas`, `payable_pesewas`, `status` (`held | released | refunded | disputed`), `qa_passed_at`, `holdback_until` (qa_passed_at + 7d), `released_at`, `refunded_at`.
   - `warranty_ledger` table: per-painter row per booking with `warranty_pesewas`, `status` (`reserved | drawn | released | forfeited`), `release_at` (booking_completed_at + 90d), `drawn_against` JSON for callback payments.
   - `ALTER TABLE payments ADD COLUMN provider TEXT NOT NULL DEFAULT 'hubtel'` — disambiguates Hubtel vs Paystack vs future rails on a per-row basis.

2. **`db/migrations/020_idempotency_keys.sql`** — `idempotency_keys (key, scope, request_hash, status_code, response_body, created_at, expires_at)` with a unique index on `(key, scope)`.

3. **`middleware/idempotency.js`** — Express middleware. Reads `Idempotency-Key` header. On hit (same key + same request hash within 24h), returns the cached response. On hit-with-different-hash, returns 409. On miss, runs the handler and caches the response.

4. **`services/payments.js`** — pivoted from Paystack stub to Hubtel:
   - `initiateCharge({ msisdn, amountGHS, bookingId, channel })` — calls Hubtel Receive Money (direct MoMo prompt), returns `{ reference, transaction_id, status }`.
   - `verifyCharge(reference)` — status lookup against Hubtel.
   - `parseCallback(rawBody, signatureHeader)` — verifies the Hubtel callback signature and parses the payload.
   - Stub mode when `HUBTEL_CLIENT_ID` is unset or `HUBTEL_MODE=stub`, so local dev and CI don't need real credentials.

5. **`routes/payments.js`** — three endpoints, mounted from `server.js` directly (the legacy `routes/index.js` is dead code and is not used):
   - `POST /api/payments/charge` — customer-auth, idempotent, creates `payments` + `escrow_holds` rows, calls `services.initiateCharge`.
   - `POST /api/payments/callback` — no auth, signature-verified against raw body, updates `payment_events` + flips `payments.status` and `escrow_holds.status`.
   - `GET  /api/payments/:reference` — owner or admin, returns current payment + escrow status.

About **3 days of engineering**, after which a customer can complete a booking, pay via MoMo, and the funds are correctly held in escrow with the holdback timer ticking. Phase 2 (earnings ledger + payroll + Hubtel Send Money) follows.
