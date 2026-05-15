-- 011_refunds.sql — refund records, separate from payments so we can issue partials.

CREATE TABLE IF NOT EXISTS refunds (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id   INTEGER NOT NULL,
  booking_id   TEXT    NOT NULL,
  amount       REAL    NOT NULL,
  reason       TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending',  -- pending | processed | failed
  gateway_ref  TEXT,
  processed_at TEXT,
  created_by   INTEGER,                              -- admin who issued it
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
