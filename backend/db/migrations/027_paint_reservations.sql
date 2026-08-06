-- 027_paint_reservations.sql — committed paint stock per quote.
--
-- When a dispatcher confirms a quote's paint volume (POST
-- /api/paint-volume/quotes/:id/confirm), each estimate line gets a matching
-- reservation row here. The inventory manager treats these as
-- already-committed stock: they're paint we've promised to a customer but
-- haven't necessarily ordered from the supplier yet.
--
-- Lifecycle:
--   reserved  (default)  — dispatcher confirmed; awaiting job day
--   consumed             — job completed; this paint actually went on a wall
--   released             — quote cancelled or rejected after the fact
--
-- Why a separate table from the existing material_usage:
--   material_usage is keyed by booking_id NOT NULL and inventory_items.id —
--   it tracks what a painter actually used on the day. Reservations are
--   created at QUOTE confirm time, before any booking exists, against the
--   paint_products catalog. Different lifecycles, different sources of
--   truth, different consumers.

CREATE TABLE IF NOT EXISTS paint_reservations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id          TEXT    NOT NULL,
  paint_product_id  INTEGER NOT NULL,
  estimate_id       INTEGER,                            -- link back to quote_volume_estimates row
  litres_reserved   REAL    NOT NULL,
  buckets_reserved  INTEGER NOT NULL,
  cost_reserved     REAL    NOT NULL,                   -- GHS material cost snapshot
  status            TEXT    NOT NULL DEFAULT 'reserved',-- reserved | consumed | released
  reserved_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  consumed_at       TEXT,
  released_at       TEXT,
  released_reason   TEXT,
  reserved_by       INTEGER,                            -- users.id of the dispatcher
  FOREIGN KEY (quote_id)         REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (paint_product_id) REFERENCES paint_products(id),
  FOREIGN KEY (estimate_id)      REFERENCES quote_volume_estimates(id) ON DELETE SET NULL,
  FOREIGN KEY (reserved_by)      REFERENCES users(id)
);

-- Inventory manager rolls up by product → litres reserved. This index
-- accelerates the common GROUP BY paint_product_id WHERE status='reserved'.
CREATE INDEX IF NOT EXISTS ix_paint_reservations_product_status
  ON paint_reservations(paint_product_id, status);

-- Per-quote lookup — used when a quote is cancelled and we need to flip
-- every line to 'released' in one statement.
CREATE INDEX IF NOT EXISTS ix_paint_reservations_quote
  ON paint_reservations(quote_id);
