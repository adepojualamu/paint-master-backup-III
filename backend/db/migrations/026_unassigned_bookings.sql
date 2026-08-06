-- 026_unassigned_bookings.sql — allow a customer booking to exist before
-- a Paint Master has been assigned to it.
--
-- The original schema (001_initial.sql) had painter_id INTEGER NOT NULL, which
-- forced every booking to be created at the moment the painter was chosen.
-- That doesn't match the real customer flow on booking.html: the customer
-- books a date and pays the deposit, and the dispatcher assigns a painter
-- afterwards. SQLite doesn't support ALTER COLUMN, so we do the standard
-- rebuild: create a new table, copy data, drop, rename, recreate indexes.
--
-- Adds two new columns at the same time:
--   painter_id can now be NULL (unassigned)
--   quote_id   TEXT, FK back to quotes(id) — links a booking to the quote
--              it came from (used by routes/bookings.js to pull pricing
--              from the existing quote record).
--
-- Idempotent — the _migrations table makes sure this only runs once.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS bookings_new (
  id              TEXT    PRIMARY KEY,
  customer_id     INTEGER NOT NULL,
  painter_id      INTEGER,                            -- nullable now
  quote_id        TEXT,                               -- nullable; FK to quotes
  service         TEXT    NOT NULL,
  address         TEXT    NOT NULL,
  job_date        TEXT    NOT NULL,
  duration_days   INTEGER NOT NULL DEFAULT 1,
  area_sqm        REAL,
  notes           TEXT,
  subtotal        REAL    NOT NULL,
  platform_fee    REAL    NOT NULL,
  total           REAL    NOT NULL,
  payment_method  TEXT    NOT NULL DEFAULT 'momo',
  payment_status  TEXT    NOT NULL DEFAULT 'pending',
  status          TEXT    NOT NULL DEFAULT 'pending', -- can now be 'pending_assignment'
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (painter_id)  REFERENCES painter_profiles(id),
  FOREIGN KEY (quote_id)    REFERENCES quotes(id)
);

INSERT INTO bookings_new (
  id, customer_id, painter_id, quote_id, service, address, job_date,
  duration_days, area_sqm, notes, subtotal, platform_fee, total,
  payment_method, payment_status, status, created_at, updated_at
)
SELECT
  id, customer_id, painter_id, NULL, service, address, job_date,
  duration_days, area_sqm, notes, subtotal, platform_fee, total,
  payment_method, payment_status, status, created_at, updated_at
FROM bookings;

DROP TABLE bookings;
ALTER TABLE bookings_new RENAME TO bookings;

-- Recreate the indexes the originals had — without these, queries by
-- customer / painter / status / job_date all degrade to full scans.
CREATE INDEX IF NOT EXISTS ix_bookings_customer      ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS ix_bookings_painter       ON bookings(painter_id);
CREATE INDEX IF NOT EXISTS ix_bookings_status        ON bookings(status);
CREATE INDEX IF NOT EXISTS ix_bookings_job_date      ON bookings(job_date);
CREATE INDEX IF NOT EXISTS ix_bookings_status_painter_created
  ON bookings(status, painter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_bookings_customer_created
  ON bookings(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_bookings_created_status
  ON bookings(date(created_at), status);

-- New index for the dispatcher's "unassigned queue" — every list of
-- pending_assignment bookings hits this constantly.
CREATE INDEX IF NOT EXISTS ix_bookings_unassigned
  ON bookings(status, created_at DESC) WHERE painter_id IS NULL;

PRAGMA foreign_keys = ON;
