-- 010_sms_email_log.sql — outbound notification trail (debug + cost tracking).

CREATE TABLE IF NOT EXISTS sms_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_phone    TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  provider    TEXT    NOT NULL DEFAULT 'hubtel',
  provider_id TEXT,
  status      TEXT    NOT NULL DEFAULT 'pending', -- pending | sent | failed | delivered
  cost        REAL,
  error       TEXT,
  related_booking_id TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (related_booking_id) REFERENCES bookings(id)
);

CREATE TABLE IF NOT EXISTS email_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email    TEXT    NOT NULL,
  subject     TEXT    NOT NULL,
  body        TEXT,
  provider    TEXT,
  provider_id TEXT,
  status      TEXT    NOT NULL DEFAULT 'pending',
  error       TEXT,
  related_booking_id TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (related_booking_id) REFERENCES bookings(id)
);
