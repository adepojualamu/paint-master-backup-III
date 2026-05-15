-- 019_escrow_holds.sql — escrow holdback + per-painter warranty ledger.
--
-- Implements the two locked Phase-1 payment decisions (see backend/docs/PAYMENTS.md):
--   * Holdback period: 7 days after QA pass before payout to painter.
--   * Warranty reserve: 5% of net booking value, per-painter, visible.
--
-- All amounts here are stored as integer pesewas (1 GHS = 100 pesewas) to avoid
-- float drift on money. utils/money.toPesewas / toCedis convert at the edges.

-- Disambiguate the gateway behind each payments row. Existing data is backfilled
-- to 'hubtel' (the new default); historical Paystack-stub rows in dev DBs can be
-- patched manually if needed.
ALTER TABLE payments ADD COLUMN provider TEXT NOT NULL DEFAULT 'hubtel';

CREATE TABLE IF NOT EXISTS escrow_holds (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id               TEXT    NOT NULL,
  payment_id               INTEGER NOT NULL,

  -- Money split, computed at the moment the charge succeeds. Pesewas, integers.
  --   gross           = booking.total in pesewas (what the customer paid)
  --   platform_fee    = 10% of subtotal (already on the booking row)
  --   net             = gross - platform_fee  (the painter's share before reserve)
  --   warranty_hold   = 5% of net             (parked in warranty_ledger)
  --   payable         = net - warranty_hold   (released to painter after holdback)
  gross_pesewas            INTEGER NOT NULL,
  platform_fee_pesewas     INTEGER NOT NULL,
  net_pesewas              INTEGER NOT NULL,
  warranty_reserve_pesewas INTEGER NOT NULL,
  payable_pesewas          INTEGER NOT NULL,

  -- State machine. held → released | refunded | disputed.
  status                   TEXT    NOT NULL DEFAULT 'held'
                                   CHECK (status IN ('held','released','refunded','disputed')),

  -- Holdback timing. holdback_until is set when QA passes (= qa_passed_at + 7 days).
  -- Until then, status stays 'held' and the nightly release job ignores the row.
  qa_passed_at             TEXT,
  holdback_until           TEXT,
  released_at              TEXT,
  refunded_at              TEXT,
  disputed_at              TEXT,

  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_escrow_holds_booking ON escrow_holds(booking_id);
CREATE        INDEX IF NOT EXISTS ix_escrow_holds_status  ON escrow_holds(status);
CREATE        INDEX IF NOT EXISTS ix_escrow_holds_release ON escrow_holds(status, holdback_until);

-- Per-painter warranty reserve. One row per booking the painter served.
-- Visible in the painter dashboard ("your held warranty: GH₵X across N jobs").
-- After release_at (= job_completed_at + 90 days) and no warranty draw, the
-- nightly job flips status to 'released' and the amount is paid out in the
-- next payroll run.
CREATE TABLE IF NOT EXISTS warranty_ledger (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  painter_id        INTEGER NOT NULL,        -- painter_profiles.id
  booking_id        TEXT    NOT NULL,
  escrow_hold_id    INTEGER NOT NULL,
  warranty_pesewas  INTEGER NOT NULL,        -- the 5% slice
  status            TEXT    NOT NULL DEFAULT 'reserved'
                            CHECK (status IN ('reserved','drawn','released','forfeited')),
  release_at        TEXT,                    -- job_completed_at + 90 days
  released_at       TEXT,
  drawn_against     TEXT,                    -- JSON: list of callback payment refs
  drawn_pesewas     INTEGER NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (painter_id)     REFERENCES painter_profiles(id),
  FOREIGN KEY (booking_id)     REFERENCES bookings(id),
  FOREIGN KEY (escrow_hold_id) REFERENCES escrow_holds(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_warranty_booking ON warranty_ledger(booking_id);
CREATE        INDEX IF NOT EXISTS ix_warranty_painter ON warranty_ledger(painter_id, status);
CREATE        INDEX IF NOT EXISTS ix_warranty_release ON warranty_ledger(status, release_at);
