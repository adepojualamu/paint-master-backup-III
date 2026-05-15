-- 003_contracts.sql — signed agreements between customer and painter for a booking.

CREATE TABLE IF NOT EXISTS contracts (
  id            TEXT    PRIMARY KEY,             -- CT-XXXXXXXX
  booking_id    TEXT    NOT NULL UNIQUE,
  body          TEXT    NOT NULL,                -- the contract text/markdown
  customer_signed_at TEXT,
  painter_signed_at  TEXT,
  customer_signature TEXT,                       -- typed name or signature image URL
  painter_signature  TEXT,
  pdf_url       TEXT,                            -- generated PDF (services/contracts.js)
  status        TEXT    NOT NULL DEFAULT 'draft', -- draft | pending_signatures | signed | voided
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);
