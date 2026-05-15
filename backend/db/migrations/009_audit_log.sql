-- 009_audit_log.sql — admin actions trail. Read-only for everyone except db.

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  action      TEXT    NOT NULL,                  -- e.g. painter.verify, review.delete
  entity_type TEXT,                              -- painter | booking | review | ...
  entity_id   TEXT,
  actor_id    INTEGER,
  actor_role  TEXT,
  ip          TEXT,
  request_id  TEXT,
  payload     TEXT,                              -- JSON snapshot of the request body
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (actor_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS ix_audit_actor   ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS ix_audit_action  ON audit_log(action);
CREATE INDEX IF NOT EXISTS ix_audit_created ON audit_log(created_at);
