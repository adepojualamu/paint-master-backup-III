-- 017_devices.sql
-- Device sessions for multi-device sign-in + push notifications.
-- Without this, signing out on one phone doesn't invalidate the other phone's
-- session — a real problem at scale (lost-phone scenarios, fraud response).

CREATE TABLE IF NOT EXISTS devices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       TEXT NOT NULL,                  -- client-generated UUID, persists per install
  platform        TEXT NOT NULL CHECK (platform IN ('ios','android','web','desktop')),
  app_version     TEXT,
  push_token      TEXT,                           -- FCM/APNs token; null on web
  user_agent      TEXT,                           -- last-seen UA string
  last_ip         TEXT,
  last_seen_at    DATETIME DEFAULT (datetime('now')),
  signed_in_at    DATETIME DEFAULT (datetime('now')),
  signed_out_at   DATETIME,
  UNIQUE (user_id, device_id)
);

-- Refresh-token table: short-lived JWTs + long-lived refresh tokens kept here.
-- Lets us revoke a single device without rotating JWT_SECRET globally.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id    INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,             -- bcrypt of the raw token
  expires_at   DATETIME NOT NULL,
  revoked_at   DATETIME,
  created_at   DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_devices_user        ON devices(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS ix_devices_push_token  ON devices(push_token) WHERE push_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user ON refresh_tokens(user_id, expires_at);
