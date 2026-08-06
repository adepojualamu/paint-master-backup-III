# Paint Masters — Business Logic & Platform Model

This document is the source of truth for how Paint Masters works as a business:
who does what, who pays for what, and how money moves through a job. Code that
contradicts this document is a bug — fix the code, not the document.

Last reviewed: 2026-05-25.

## Platform model

Paint Masters is a **managed marketplace**, not a lead-generation directory. The
platform owns the materials, the inventory and the logistics. The painters —
"Paint Masters" — provide **labour only**.

Concretely, a painter on this platform:

- does **not** source paint, primer or sundries;
- does **not** front the cost of materials;
- does **not** submit receipts or get reimbursed for purchases;
- simply renders the painting service and is paid for that service.

Everything material-related — buying paint, holding stock, reserving it against
a job, getting it to site — is the platform's responsibility. This is why the
codebase has `paint_products`, `paint_reservations` and the inventory screens:
the platform runs a real supply chain, and the painter steps into a job where
the paint is already accounted for.

## The money model

Every customer quote is the sum of three distinct components:

**Labour** — the value of the painter's service for the job.

**Materials** — the platform's cost of the paint, primer and sundries the job
needs, drawn from platform inventory. Materials are a **pass-through**: the
customer reimburses the platform's material cost and the platform pays the
supplier. The platform does not mark materials up — materials net to zero as a
profit line.

**Platform fee** — a 10% fee charged on the **labour** amount. This is the
platform's commission for running the marketplace: dispatch, QA sign-off,
the 12-month warranty, payments and support.

**VAT** — Ghana VAT (12.5% by default) is applied to the pre-tax total and is
included in the price the customer pays. VAT is a tax pass-through: it is not
platform revenue and is not part of the painter payout base.

So the customer's total is:

> **Pre-tax total = Labour + Materials + (10% × Labour)**
> **Total = Pre-tax total + (12.5% × Pre-tax total)**

**Rates are operator-owned.** Every number above — the per-service labour
rates, the materials rate, the default day-rate, the platform-fee %, the
painter-payout % and the VAT % — lives in the editable **rate card**
(`pricing_settings` table, migration 031) and is changed from the admin portal
(**Pricing**, `admin/pricing.html` → `/api/admin/pricing`), not in code. The
canonical engine reads the rate card via `services/rateCard.js`, and the quote
page displays the engine's number (`POST /api/quotes/preview`) so the price a
customer sees is the price they are charged — there is no second client-side
formula to drift.

### Who gets paid what

When a job is completed and QA-approved, the money splits like this:

- **Painter payout = 90% × Labour.** The painter's 90% is calculated on the
  **labour amount only**. Materials and the platform fee are *not* part of the
  payout base — the painter never receives a share of materials money or of the
  platform fee.
- **Materials money → the paint supplier.** The platform holds the materials
  portion of the customer's payment and uses it to pay for the paint it
  supplied. It is a conduit; this money never touches the painter.
- **Platform revenue = 20% × Labour** — the 10% retained from the labour split
  plus the 10% platform fee.

### Worked example

A job with **GH₵2,000 of labour** and **GH₵1,000 of platform-supplied paint**:

| Line | Amount |
|---|---|
| Labour | GH₵2,000 |
| Materials (pass-through) | GH₵1,000 |
| Platform fee (10% of labour) | GH₵200 |
| Pre-tax total | GH₵3,200 |
| VAT (12.5% of pre-tax total) | GH₵400 |
| **Customer pays (total)** | **GH₵3,600** |
| Painter payout (90% of labour) | GH₵1,800 |
| Paid to paint supplier | GH₵1,000 |
| VAT remitted to GRA | GH₵400 |
| **Platform revenue (20% of labour)** | **GH₵400** |

The painter is paid GH₵1,800 for their labour. The customer's GH₵1,000 of
materials money flows through the platform to the paint supplier, and the
GH₵400 VAT is remitted to the tax authority. The platform keeps GH₵400 (the
10% retained from the labour split plus the 10% platform fee) — VAT does not
change platform revenue.

### Implementation notes

The labour/materials split above is enforced in code:

1. `services/pricing.js` `calculateQuote()` returns a discrete **labour**
   figure (= `labour_day + labour_sqm`) and computes
   `platform_fee = labour × PLATFORM_FEE_PCT`. Materials sit alongside as a
   pass-through line.
2. Migration `030_labour_column.sql` added a `labour` column to `quotes` and
   `bookings`. Quote / booking create routes persist it; the QA-approve
   handler reads it for the payout.
3. `routes/bookings.js` (QA-approve) computes `payout = labour × 0.90`. For
   any legacy row written before migration 030 (where `labour` is NULL), the
   handler derives labour from `platform_fee / PLATFORM_FEE_PCT` — the same
   value, because `platform_fee` has always been computed on the labour base
   alone.

One smaller, related gap still open: `materials_included` is currently an
**optional** flag on the quote API, with `MATERIALS_PER_SQM` only added when
the customer opts in. The model above says materials are always
platform-supplied and therefore always in the quote. Tightening the API to
make materials non-optional belongs with the broader pricing-reconciliation
roadmap item, since it also touches the client-side quote calculator.

## Job lifecycle

A job moves through these stages:

1. **Quote** — the customer builds a quote on `quote.html`: service, scope,
   dimensions and the paint products they want. As part of finalizing the
   quote they may attach **photos of their space** (see below).
2. **Volume gate** — a dispatcher reviews the litres/buckets/cost the volume
   calculator produced and confirms the estimate. A quote cannot be finalized
   until this sign-off happens. Confirming the volume reserves the required
   paint from inventory (`paint_reservations`).
3. **Finalize → booking** — the finalized quote becomes a booking. A
   customer-originated booking lands in `status = 'pending_assignment'`.
4. **Assignment** — a dispatcher assigns a Paint Master. The booking moves to
   `pending` and the painter receives a **"job assigned" alert**
   (`booking.assigned` notification).
5. **Confirmation** — the painter confirms the job (`confirmed`). At this point
   the full **job description** — service, address, dates, scope and the
   customer's space photos — is available to the painter so they know the task
   ahead before arriving on site.
6. **Execution** — `in_progress` while the painter works.
7. **QA** — the painter marks the job done (`qa_pending`); QA inspects. On
   approval the booking moves to `completed`, the paint reservations are
   consumed, the **painter payout (90% of labour) is released**, and the
   12-month finish warranty starts. On rejection the job returns to
   `in_progress` with rework notes.
8. **Cancellation** — a booking can be cancelled before completion; paint
   reservations are released back to inventory and the refund follows the
   cancellation policy.

## Customer space photos

As part of finalizing a quote, customers can attach photos of the spaces to be
painted. The intent is simple: let the platform and the painter see the real
task ahead before anyone commits.

These photos are:

- stored against the **quote** (`quote_photos`), not against a booking, because
  they are captured before a booking exists;
- shown to the **dispatcher** during the volume-gate review, so the volume
  estimate can be sanity-checked against the actual space;
- shown to the **assigned painter** as part of the job description, so they
  arrive prepared.

This is a customer convenience and a planning aid — it does not replace the
on-site assessment, and it does not change the quote price by itself.

## Notifications

Lifecycle transitions emit events through the outbox pipeline
(`notifications.emit` → `notifications_outbox` → `notifyWorker` → SMS/email).
The painter's "job assigned" alert is the `booking.assigned` event; the
customer's booking, confirmation, completion and cancellation messages are the
`booking.*` and `qa.*` events. Sending is record-only until real Hubtel and
email-provider credentials are set in `backend/.env`.
