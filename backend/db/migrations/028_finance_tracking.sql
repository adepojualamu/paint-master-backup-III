-- 028_finance_tracking.sql — finance sub-role tracking columns.
--
-- We need two things the existing schema can't express:
--   - "Has the painter been paid out for this completed job yet?"
--     bookings.payment_status is about the CUSTOMER's escrow deposit, not
--     the painter's payout. They're different sides of the transaction.
--   - "Has the customer's refund actually been processed?"
--     bookings.status='cancelled' only tells us the booking was killed.
--     The refunds table tracks real-gateway refund executions, but until
--     a payment gateway is live we need a finance-side "issued" stamp so
--     the dashboard doesn't keep showing the same cancelled booking forever.
--
-- Both columns nullable + indexable so the finance dashboard's "pending"
-- queues are a simple "WHERE col IS NULL" scan.

ALTER TABLE bookings ADD COLUMN painter_paid_at        TEXT;
ALTER TABLE bookings ADD COLUMN painter_paid_by        INTEGER;   -- finance user.id
ALTER TABLE bookings ADD COLUMN refund_processed_at    TEXT;
ALTER TABLE bookings ADD COLUMN refund_processed_by    INTEGER;

CREATE INDEX IF NOT EXISTS ix_bookings_payout_due
  ON bookings(status, painter_paid_at)
  WHERE status = 'completed' AND painter_paid_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_bookings_refund_due
  ON bookings(status, refund_processed_at)
  WHERE status = 'cancelled' AND refund_processed_at IS NULL;
