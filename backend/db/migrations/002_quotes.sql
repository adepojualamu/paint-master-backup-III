-- 002_quotes.sql — saved quotes that can convert into bookings.
-- The frontend's quote.html computes a quote in-browser; this stores it.

CREATE TABLE IF NOT EXISTS quotes (
  id              TEXT    PRIMARY KEY,           -- QT-XXXXXXXX
  customer_id     INTEGER,                       -- nullable: anonymous quotes allowed
  painter_id      INTEGER,                       -- nullable: customer hasn't picked one yet
  service         TEXT    NOT NULL,
  area_sqm        REAL    NOT NULL,
  duration_days   INTEGER NOT NULL,
  materials_included INTEGER DEFAULT 0,
  city            TEXT,
  address         TEXT,
  notes           TEXT,
  subtotal        REAL    NOT NULL,
  platform_fee    REAL    NOT NULL,
  total           REAL    NOT NULL,
  pricing_breakdown TEXT,                        -- JSON dump of services/pricing.js output
  expires_at      TEXT    NOT NULL,              -- quotes expire after 14 days
  converted_booking_id TEXT,                     -- set when this quote becomes a booking
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (painter_id)  REFERENCES painter_profiles(id),
  FOREIGN KEY (converted_booking_id) REFERENCES bookings(id)
);
