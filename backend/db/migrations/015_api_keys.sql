-- 015_api_keys.sql
-- Long-lived credentials for partner integrations + the mobile app.
-- Distinct from JWT (which is short-lived, per-session). API keys are
-- per-issuer (a partner brand, an internal mobile app build, etc).

CREATE TABLE IF NOT EXISTS api_keys (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash      TEXT NOT NULL UNIQUE,           -- bcrypt of the raw key; never stored plain
  prefix        TEXT NOT NULL,                  -- first 8 chars, shown in admin UI
  name          TEXT NOT NULL,                  -- 'Mobile App iOS', 'Dulux Partner Portal'
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scopes        TEXT NOT NULL DEFAULT '["read"]', -- JSON array: read,write,admin,...
  rate_limit    INTEGER NOT NULL DEFAULT 1000,    -- requests per hour (0 = unlimited)
  last_used_at  DATETIME,
  expires_at    DATETIME,                        -- NULL = never expires
  revoked_at    DATETIME,
  created_at    DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_api_keys_prefix       ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS ix_api_keys_owner        ON api_keys(owner_user_id);
CREATE INDEX IF NOT EXISTS ix_api_keys_active
  ON api_keys(revoked_at, expires_at)
  WHERE revoked_at IS NULL;
