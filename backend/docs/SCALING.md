# Scaling Paint Masters

A field guide to how this backend handles growth — what the schema already does, what each new migration buys us, and where the real ceilings are.

## Quick framing

The phrase "13-table database" came up in an earlier status update. That was a count of **distinct entity types** (users, bookings, payments, etc.) — *not* a row capacity. SQLite tables hold unlimited rows. Each existing table can comfortably grow to **millions of rows** without a schema change.

Real scaling is about three things:

1. **Indexes** — making queries stay fast as row counts grow.
2. **Concurrency primitives** — letting multiple workers serve traffic without stepping on each other.
3. **Async patterns** — moving slow work (SMS, email, payouts) off the request path.

Migrations 013–018 add what we'll need for each.

---

## What's in the new migrations

### 013 — Composite indexes (`013_composite_indexes.sql`)

The original `012_indexes.sql` indexed each filterable column individually. At scale, the queries that hurt are the **multi-column** ones — "show me all confirmed bookings for painter X, newest first." Single-column indexes can't satisfy those without a sort scan.

| Index | Speeds up |
|-------|-----------|
| `ix_bookings_status_painter_created` | Painter dashboard "my upcoming jobs" |
| `ix_bookings_customer_created` | Customer "my bookings" list |
| `ix_bookings_created_status` | Daily revenue analytics |
| `ix_painters_city_rate_rating` (partial) | Public painters listing — only non-suspended |
| `ix_reviews_painter_created` (partial) | Painter profile reviews — only non-hidden |
| `ix_audit_entity` | "Show me the history of booking PM-XXX" |

Partial indexes (`WHERE …`) keep the index small by excluding soft-deleted rows we never query.

### 014 — Notifications outbox (`014_notifications_outbox.sql`)

Right now, when a customer books, the booking response waits for SMS + email to send. At scale that's brittle: a Hubtel hiccup means every booking takes 8 seconds. The outbox pattern decouples them — a route writes a row to `notifications_outbox` and returns immediately. A worker (later: a `pm2` process or a tiny serverless function) drains the queue and handles retries.

This is the single most important pattern for surviving Ghana's mobile network reality, where a request to Hubtel can hang for 30 seconds without warning.

### 015 — API keys (`015_api_keys.sql`)

JWTs are short-lived per-session credentials — great for users, terrible for partner integrations. API keys are long-lived, scoped, revocable. We'll need them for:

- The mobile app (one key per build, revocable when an old version is sunset)
- Partner brands (Dulux's portal might want to see their inventory levels)
- Analytics consumers (a future BI tool)

Each key stores a bcrypt hash + a 8-char prefix shown in the admin UI — you can identify a key without having the secret.

### 016 — Feature flags (`016_feature_flags.sql`)

The single most underrated tool for shipping fast at scale. Lets you:

- Roll a new pricing engine to 5% of customers, watch metrics, then dial up.
- Force-disable a feature for a specific user (anti-fraud).
- Region-gate features (`{"city": "Accra"}` rule) without redeploying.

Two tables: `feature_flags` for the rule, `feature_flag_overrides` for per-user exceptions.

### 017 — Devices + refresh tokens (`017_devices.sql`)

Right now, signing out on one phone doesn't revoke the JWT on the other phone — it just expires whenever it expires. At scale that's a real safety problem (lost-phone scenarios, account takeovers). The `devices` table tracks every install + push token; `refresh_tokens` lets us issue short-lived JWTs paired with long-lived refresh tokens we can revoke per-device.

Side benefit: this is what enables push notifications. Without `push_token` per device, FCM/APNs has nowhere to send.

### 018 — Persistent rate limits (`018_rate_limits.sql`)

`express-rate-limit` defaults to in-memory state. The moment you have two Node processes (`pm2` cluster mode, or two app servers behind a load balancer), each process has its own counter and an attacker effectively gets `2× rate_limit` requests for free. This table is the shared source of truth — every worker reads/writes the same rows.

---

## How far SQLite takes us

SQLite isn't toy software. WhatsApp's old text history was SQLite. Expensify uses it for billions of rows. The realistic ceilings for *this* application:

| Metric | Comfortable | Push it | Replace SQLite |
|--------|-------------|---------|-----------------|
| Total customers | 100k | 500k | 1M+ |
| Bookings per day | 1,000 | 5,000 | 20,000+ |
| Concurrent writes | 30/sec | 100/sec | 500+/sec |
| App servers | 1 | 2 (replication) | many |

The "Replace SQLite" column is when we'd graduate to **PostgreSQL**. The migration is mostly mechanical because:

- The SQL we write is standard ANSI — no SQLite-specific functions.
- Better-sqlite3's `db.prepare(...).run(...)` API maps 1:1 to `pg`'s.
- Our migrations live in plain `.sql` files; PostgreSQL accepts most of them unchanged.

Things that need adjustment when moving to PostgreSQL:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY` or `BIGSERIAL`.
- `datetime('now')` → `now()` or `current_timestamp`.
- JSON columns: SQLite stores TEXT; PostgreSQL has native `jsonb`.

About a half-day of work, plus a careful data export.

---

## Operational checklist as we grow

| At this scale | Do this |
|---------------|---------|
| First 100 bookings | Daily SQLite backup via `cron` (already scaffolded in `db/backup.sh`) |
| 1,000 bookings | Spin up the notifications worker as a separate process |
| 10,000 bookings | Add read replicas (SQLite's WAL allows concurrent reads); enable feature flags for risky rollouts |
| 100,000 bookings | Move to PostgreSQL; introduce Redis for hot-path caching (painter availability, current bookings) |
| 500,000+ bookings | Multi-region deploys; consider sharding by region (Accra DB, Kumasi DB, etc.) |

---

## What "13 entries" actually meant

For clarity, here's the table count by migration:

| Migration | New tables |
|-----------|-----------|
| 001_initial | users, painter_profiles, bookings, reviews |
| 002_quotes | quotes |
| 003_contracts | contracts |
| 004_milestones | job_milestones |
| 005_payments | payments, payment_events |
| 006_inventory | suppliers, inventory_items, purchase_orders, purchase_order_items, material_usage |
| 007_customer_notes | customer_notes |
| 008_photos | painter_photos, job_photos |
| 009_audit_log | audit_log |
| 010_sms_email_log | sms_log, email_log |
| 011_refunds | refunds |
| 012_indexes | _(none — indexes only)_ |
| 013_composite_indexes | _(none)_ |
| 014_notifications_outbox | notifications_outbox |
| 015_api_keys | api_keys |
| 016_feature_flags | feature_flags, feature_flag_overrides |
| 017_devices | devices, refresh_tokens |
| 018_rate_limits | rate_limit_records |

That's **27 tables** today, each with no row limit imposed by us — only by disk space.
