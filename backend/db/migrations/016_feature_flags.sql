-- 016_feature_flags.sql
-- Gradual rollouts. Lets us ship a feature to 5% of customers, watch metrics,
-- then dial up — without redeploying. Critical at scale: lets us de-risk
-- changes like a new pricing engine or a new payment provider.

CREATE TABLE IF NOT EXISTS feature_flags (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  flag_key      TEXT NOT NULL UNIQUE,           -- 'inspection_required_above_500m2'
  description   TEXT,
  enabled       INTEGER NOT NULL DEFAULT 0,     -- master kill switch
  rollout_pct   INTEGER NOT NULL DEFAULT 0      -- 0..100; % of users seeing the variant
                CHECK (rollout_pct BETWEEN 0 AND 100),
  rules         TEXT NOT NULL DEFAULT '{}',     -- JSON; e.g. {"city": "Accra"}
  created_at    DATETIME DEFAULT (datetime('now')),
  updated_at    DATETIME DEFAULT (datetime('now'))
);

-- Per-user overrides (e.g. force-enable for staff, force-disable for a banned account).
CREATE TABLE IF NOT EXISTS feature_flag_overrides (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  flag_key      TEXT NOT NULL,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled       INTEGER NOT NULL,
  reason        TEXT,
  created_at    DATETIME DEFAULT (datetime('now')),
  UNIQUE (flag_key, user_id)
);

CREATE INDEX IF NOT EXISTS ix_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS ix_feature_flag_overrides_user
  ON feature_flag_overrides(user_id);
