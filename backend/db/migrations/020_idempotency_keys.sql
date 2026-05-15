-- 020_idempotency_keys.sql — keyed cache of payment-mutating responses.
--
-- Used by middleware/idempotency.js to make POST /api/payments/charge and
-- POST /api/payments/callback safe to retry without double-charging or
-- double-recording. Hubtel's webhook can fire twice; clients can retry on
-- network blips. Both come through the same defensive layer.
--
-- Lifecycle:
--   * Client (or Hubtel) sends Idempotency-Key header.
--   * Middleware looks up (key, scope). On hit with matching request_hash,
--     returns the cached status_code + response_body directly.
--   * On hit with DIFFERENT request_hash, returns 409 — same key reused
--     for a different request body is a programming error.
--   * On miss, runs the handler, captures the response, caches it.
--   * Rows are pruned by a nightly job after expires_at (default +24h).

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  key           TEXT    NOT NULL,                    -- the Idempotency-Key header value
  scope         TEXT    NOT NULL,                    -- e.g. 'payments.charge', 'payments.callback'
  request_hash  TEXT    NOT NULL,                    -- sha256 of method+path+body
  status_code   INTEGER NOT NULL,
  response_body TEXT    NOT NULL,                    -- JSON string
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at    TEXT    NOT NULL DEFAULT (datetime('now', '+24 hours'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_idempotency_key_scope
  ON idempotency_keys(key, scope);

CREATE INDEX IF NOT EXISTS ix_idempotency_expires
  ON idempotency_keys(expires_at);
