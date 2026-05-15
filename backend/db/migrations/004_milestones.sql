-- 004_milestones.sql — granular progress tracking for the customer's track.html page.

CREATE TABLE IF NOT EXISTS job_milestones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id   TEXT    NOT NULL,
  label        TEXT    NOT NULL,                 -- e.g. "Site prep", "Primer applied"
  description  TEXT,
  completed_at TEXT,
  position     INTEGER NOT NULL DEFAULT 0,       -- display order
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_milestones_booking ON job_milestones(booking_id);
