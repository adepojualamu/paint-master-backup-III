-- 008_photos.sql — painter portfolio + before/after job photos.

CREATE TABLE IF NOT EXISTS painter_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  painter_id  INTEGER NOT NULL,
  url         TEXT    NOT NULL,
  caption     TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (painter_id) REFERENCES painter_profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_painter_photos_painter ON painter_photos(painter_id);

CREATE TABLE IF NOT EXISTS job_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id  TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  kind        TEXT    NOT NULL DEFAULT 'progress', -- before | progress | after | issue
  caption     TEXT,
  uploaded_by INTEGER,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id)  REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS ix_job_photos_booking ON job_photos(booking_id);
