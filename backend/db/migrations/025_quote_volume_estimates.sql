-- 025_quote_volume_estimates.sql — paint volume gate before quote finalization.
--
-- A quote may have ONE OR MORE line items (one per paint product, e.g. wall
-- paint + ceiling paint + trim enamel). Each line carries the inputs the
-- calculator received and the computed output. A dispatcher (or super_admin)
-- reviews the lines and either confirms or rejects; until 'confirmed', the
-- quote cannot be converted into a contract.

-- Per-quote volume status. Living on the quote itself so existing quote
-- queries don't have to join.
ALTER TABLE quotes ADD COLUMN volume_status TEXT NOT NULL DEFAULT 'pending_review';
ALTER TABLE quotes ADD COLUMN volume_confirmed_by INTEGER;      -- users.id of the dispatcher/super_admin
ALTER TABLE quotes ADD COLUMN volume_confirmed_at TEXT;

CREATE TABLE IF NOT EXISTS quote_volume_estimates (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id              TEXT    NOT NULL,
  paint_product_id      INTEGER NOT NULL,
  -- Inputs captured at the moment of estimation. We store them so a later
  -- audit can re-run the math even if the product's coverage changes.
  surface_area_sqm      REAL    NOT NULL,
  coats                 INTEGER NOT NULL DEFAULT 2,
  coverage_m2_per_litre REAL    NOT NULL,        -- snapshot from paint_products
  bucket_size_litres    REAL    NOT NULL,        -- snapshot
  -- Computed outputs.
  litres_needed         REAL    NOT NULL,
  buckets_needed        INTEGER NOT NULL,
  cost_estimate         REAL    NOT NULL,        -- GHS material cost only
  -- Workflow.
  notes                 TEXT,
  created_by            INTEGER,                 -- usually the painter or customer who entered dimensions
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (quote_id)         REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (paint_product_id) REFERENCES paint_products(id),
  FOREIGN KEY (created_by)       REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS ix_qve_quote_id ON quote_volume_estimates(quote_id);
