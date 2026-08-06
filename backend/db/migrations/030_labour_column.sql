-- 030_labour_column.sql
-- Adds a `labour` column to quotes and bookings: the painter's total labour
-- compensation base (day-rate × days + per-sqm × area), excluding materials
-- and the platform fee. See docs/business-logic.md.
--
-- This is the payout base the spec calls for. The existing payout calc in
-- routes/bookings.js (qa-approve) used `total × PAINTER_PAYOUT_PCT`, which
-- paid the painter 90% of materials and the platform fee too — overpaying
-- on every job and putting the platform underwater on material-heavy jobs.
--
-- After this migration:
--   • new rows store `labour` directly (set by services/pricing.js);
--   • legacy rows have `labour` NULL — the qa-approve handler falls back to
--     `subtotal − materials` (which equals labour, by construction of how
--     subtotal was previously computed).

ALTER TABLE quotes   ADD COLUMN labour REAL;
ALTER TABLE bookings ADD COLUMN labour REAL;
