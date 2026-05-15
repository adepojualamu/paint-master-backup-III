-- 021_job_photo_uploads.sql
--
-- Customer-uploaded progress photos. Files are written to disk under
-- backend/uploads/job-photos/<bookingRef>/<sha>.<ext>; this table holds
-- the metadata + moderation status. Admins approve/reject before the
-- photo shows on the customer dashboard.
--
-- Status flow:
--   pending  ← every new upload starts here. Admin sees it in the queue.
--   approved ← visible to the customer + assigned painter on track.html.
--   rejected ← hidden from customer; reason stored for audit.

CREATE TABLE IF NOT EXISTS job_photo_uploads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id      TEXT    NOT NULL,
  customer_id     INTEGER NOT NULL,
  filename        TEXT    NOT NULL,         -- on-disk filename (sha256 + ext)
  original_name   TEXT    NOT NULL,         -- the customer's original filename
  mime_type       TEXT    NOT NULL,
  size_bytes      INTEGER NOT NULL,
  storage_path    TEXT    NOT NULL,         -- relative to UPLOADS_LOCAL_DIR
  status          TEXT    NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  uploaded_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  approved_at     TEXT,
  approved_by     INTEGER,                  -- admin user id
  rejected_reason TEXT,                     -- optional, surfaced to customer
  caption         TEXT,                     -- optional, customer-supplied
  FOREIGN KEY (booking_id)  REFERENCES bookings(id),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS ix_job_photo_uploads_booking ON job_photo_uploads(booking_id);
CREATE INDEX IF NOT EXISTS ix_job_photo_uploads_status  ON job_photo_uploads(status, uploaded_at);
