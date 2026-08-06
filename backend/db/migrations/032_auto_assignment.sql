-- 032_auto_assignment.sql — support system-driven painter assignment with an
-- admin approval gate.
--
-- New customer bookings still land in status='pending_assignment' (painter_id
-- NULL). The auto-assigner (services/autoAssign.js) then proposes the best
-- eligible, available painter and moves the booking to a NEW state:
--
--     'pending_approval'  — a painter has been auto-proposed and is attached
--                           (painter_id set), but the painter has NOT been
--                           notified yet. A dispatcher must approve before the
--                           booking advances to 'pending' (painter confirms).
--
-- This is a purely additive migration — two new columns + one index. No table
-- rebuild, so it can't hit the FK-drop hazard that 026 did.
--
-- Columns added:
--   assignment_mode        how the *current* painter got attached:
--                            'auto'   — chosen by the auto-assigner
--                            'manual' — chosen by a dispatcher (assign/reassign)
--                            NULL     — no painter attached yet
--   rejected_painter_ids   JSON array of painter ids a dispatcher rejected for
--                          THIS booking. The auto-assigner skips them so a
--                          rejected painter is never re-proposed for the same job.
--
-- Idempotent via the _migrations registry; ADD COLUMN is guarded so a partial
-- re-run is harmless.

ALTER TABLE bookings ADD COLUMN assignment_mode TEXT;
ALTER TABLE bookings ADD COLUMN rejected_painter_ids TEXT NOT NULL DEFAULT '[]';

-- The dispatcher's "awaiting approval" queue reads this constantly — every
-- proposed booking is listed by status='pending_approval', newest first.
CREATE INDEX IF NOT EXISTS ix_bookings_pending_approval
  ON bookings(status, created_at DESC) WHERE status = 'pending_approval';
