-- 031_pricing_settings.sql — operator-editable pricing rate card.
--
-- Until now every pricing number lived hardcoded in config/constants.js, so
-- changing a rate meant a code deploy, and the customer-facing quote page
-- carried its own divergent multiplier model. This table makes the rate card
-- the single, operator-owned source of truth: the canonical engine
-- (services/pricing.js, via services/rateCard.js) reads these values, the
-- quote page displays the number the engine produced, and an admin edits the
-- rates from the portal (admin/pricing.html → /api/admin/pricing).
--
-- Design:
--   • One row per setting, keyed by a stable string. The editable catalog
--     (labels, bounds, grouping) is defined in code (config/pricingSchema.js)
--     so validation and the admin UI stay in one place; this table only holds
--     the operator's chosen values.
--   • value is REAL for every setting — currency amounts (GHS), per-sqm rates,
--     and fractions (e.g. 0.10 = 10%). The schema in code says how to render
--     and validate each one.
--   • Seeded here with the exact values that were previously hardcoded, so the
--     behaviour is identical the moment this migration runs — only now the
--     numbers are data, not code.

CREATE TABLE IF NOT EXISTS pricing_settings (
  key         TEXT    PRIMARY KEY,
  value       REAL    NOT NULL,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_by  INTEGER,                       -- users.id of the admin who last set it
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Per-service labour rate (GHS per sqm). Keys mirror C.RATE_PER_SQM.
INSERT OR IGNORE INTO pricing_settings (key, value) VALUES
  ('rate_per_sqm.Interior',      14),
  ('rate_per_sqm.Exterior',      18),
  ('rate_per_sqm.Commercial',    22),
  ('rate_per_sqm.Decorative',    35),
  ('rate_per_sqm.Waterproofing', 28),
  ('rate_per_sqm.Repaint',       12);

-- Platform economics + materials.
INSERT OR IGNORE INTO pricing_settings (key, value) VALUES
  ('materials_per_sqm',        45),     -- GHS per sqm of platform-supplied paint + primer
  ('default_rate_per_day',     500),    -- GHS day-rate for anonymous (unassigned) quotes
  ('platform_fee_pct',         0.10),   -- fee added on top of labour
  ('painter_payout_pct',       0.90);   -- painter's share of labour

-- Tax. NEW: VAT was previously absent server-side while the quote page added
-- 12.5%. The reconciliation makes VAT a first-class, operator-set line.
INSERT OR IGNORE INTO pricing_settings (key, value) VALUES
  ('vat_pct',                  0.125);  -- Ghana VAT (12.5%), applied to the pre-tax total
