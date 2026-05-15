-- 014_notifications_outbox.sql
-- Async notifications queue. Instead of blocking a request on Hubtel/Resend,
-- routes write here and a worker dispatches in the background.
-- This is what lets the system survive bursts (e.g. a region rolls out and
-- 200 SMS go out at once) without timing out customer-facing requests.

CREATE TABLE IF NOT EXISTS notifications_outbox (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  channel       TEXT NOT NULL CHECK (channel IN ('sms','email','push','whatsapp')),
  recipient     TEXT NOT NULL,                  -- phone or email
  template      TEXT NOT NULL,                  -- e.g. 'booking_confirmed'
  payload       TEXT NOT NULL,                  -- JSON merge vars
  related_type  TEXT,                            -- 'booking','quote','payment'
  related_id    TEXT,                            -- ID in that entity table
  status        TEXT NOT NULL DEFAULT 'pending' -- pending → sending → sent | failed
                CHECK (status IN ('pending','sending','sent','failed','dlq')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  scheduled_at  DATETIME DEFAULT (datetime('now')),
  sent_at       DATETIME,
  created_at    DATETIME DEFAULT (datetime('now')),
  updated_at    DATETIME DEFAULT (datetime('now'))
);

-- Worker pulls due-and-pending jobs in created_at order.
CREATE INDEX IF NOT EXISTS ix_outbox_due
  ON notifications_outbox(status, scheduled_at)
  WHERE status IN ('pending','failed');

-- For audit / customer support: "show me everything we sent to this number".
CREATE INDEX IF NOT EXISTS ix_outbox_recipient
  ON notifications_outbox(recipient, created_at DESC);
