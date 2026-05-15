-- 018_rate_limits.sql
-- Persistent rate-limit window storage. The express-rate-limit middleware
-- defaults to in-memory state, which gets blown away on every restart and
-- doesn't share state across multiple Node processes. As we scale to multiple
-- workers / instances behind a load balancer, this table lets all of them
-- share a single source of truth.

CREATE TABLE IF NOT EXISTS rate_limit_records (
  bucket_key   TEXT NOT NULL,                    -- e.g. 'ip:154.160.5.12' or 'user:42'
  window_start DATETIME NOT NULL,                -- start of the current 1-minute window
  hits         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key, window_start)
);

-- TTL-style cleanup index: workers periodically DELETE rows older than X.
CREATE INDEX IF NOT EXISTS ix_rate_limit_window
  ON rate_limit_records(window_start);

-- For monitoring: top N abusers in the last hour.
CREATE INDEX IF NOT EXISTS ix_rate_limit_hits
  ON rate_limit_records(hits DESC, window_start DESC);
