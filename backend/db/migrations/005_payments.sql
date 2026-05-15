-- 005_payments.sql — payment records + raw webhook events for audit/replay.

CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  reference    TEXT    NOT NULL UNIQUE,          -- our PAY-XXXX, sent to gateway
  gateway_ref  TEXT    UNIQUE,                   -- Paystack's reference string
  booking_id   TEXT    NOT NULL,
  customer_id  INTEGER NOT NULL,
  amount       REAL    NOT NULL,                 -- GHS
  currency     TEXT    NOT NULL DEFAULT 'GHS',
  channel      TEXT,                             -- card | mobile_money | bank | ...
  status       TEXT    NOT NULL DEFAULT 'pending', -- pending | success | failed | abandoned
  raw_response TEXT,                             -- JSON from gateway
  paid_at      TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id)  REFERENCES bookings(id),
  FOREIGN KEY (customer_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS ix_payments_booking ON payments(booking_id);

CREATE TABLE IF NOT EXISTS payment_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id  INTEGER,
  event_type  TEXT    NOT NULL,                  -- charge.success, charge.failed, refund.processed
  body        TEXT    NOT NULL,                  -- raw JSON
  signature   TEXT,                              -- header signature for verification
  received_at TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);
