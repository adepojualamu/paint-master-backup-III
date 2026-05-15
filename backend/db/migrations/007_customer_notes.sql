-- 007_customer_notes.sql — admin CRM notes attached to a customer record.

CREATE TABLE IF NOT EXISTS customer_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  author_id   INTEGER NOT NULL,                  -- which admin wrote it
  body        TEXT    NOT NULL,
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (author_id)   REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS ix_customer_notes_customer ON customer_notes(customer_id);
