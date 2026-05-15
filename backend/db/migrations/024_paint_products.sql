-- 024_paint_products.sql — paint product catalog.
--
-- Kept SEPARATE from RATE_PER_SQM service types. Service types describe
-- the JOB (Interior / Exterior / Decorative / ...). Paint products describe
-- the MATERIAL — what's actually going on the wall — and carry the data the
-- volume calculator needs:
--   - coverage_m2_per_litre        (single coat)
--   - coats_recommended            (e.g. 2 for emulsion, 2-3 for floor)
--   - price_per_litre              (GHS — cost basis; quote pricing still
--                                   flows through services/pricing.js)
--   - bucket_size_litres           (so the calculator can return whole-bucket counts)
--
-- The inventory manager edits this table; the dispatcher reads from it
-- when reviewing volume estimates.

CREATE TABLE IF NOT EXISTS paint_products (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT    NOT NULL UNIQUE,
  type                  TEXT    NOT NULL,          -- interior | wall_ceiling | furniture_trim |
                                                   -- floor | exterior | air_purifying |
                                                   -- pet_dwelling | chalkboard | emr_shielding
  brand                 TEXT,
  finish                TEXT,                      -- matt | satin | gloss | textured
  coverage_m2_per_litre REAL    NOT NULL,          -- single-coat coverage
  coats_recommended     INTEGER NOT NULL DEFAULT 2,
  price_per_litre       REAL    NOT NULL DEFAULT 0,  -- GHS
  bucket_size_litres    REAL    NOT NULL DEFAULT 20, -- typical Ghana market: 4 L or 20 L
  notes                 TEXT,
  active                INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_paint_products_type_active
  ON paint_products(type, active);

-- Seed: the nine paint categories the business covers. Values are sensible
-- industry defaults — the inventory_manager should tune price_per_litre and
-- exact coverage to local supplier data.
INSERT OR IGNORE INTO paint_products
  (name,                                  type,             finish,    coverage_m2_per_litre, coats_recommended, price_per_litre, bucket_size_litres, notes)
VALUES
  ('Interior Emulsion (standard)',        'interior',       'matt',    11,                    2,                 55,              20,                 'General-purpose interior walls.'),
  ('Wall & Ceiling Emulsion',             'wall_ceiling',   'matt',    11,                    2,                 50,              20,                 'Low-sheen, high-hide for ceilings.'),
  ('Furniture & Trim Enamel',             'furniture_trim', 'gloss',   13,                    2,                 95,              4,                  'Oil-based; doors, skirting, furniture.'),
  ('Floor-based Epoxy',                   'floor',          'gloss',    9,                    2,                 140,             4,                  'Two-pack epoxy for concrete floors.'),
  ('Exterior Masonry',                    'exterior',       'matt',     7,                    2,                 75,              20,                 'Weather-resistant; rough surfaces.'),
  ('Air-Purifying Interior',              'air_purifying',  'matt',    10,                    2,                 120,             4,                  'Absorbs VOCs / formaldehyde.'),
  ('Pet-Dwelling Washable',               'pet_dwelling',   'satin',   10,                    2,                 110,             4,                  'Scrubbable; pet-safe low-odour.'),
  ('Chalkboard Finish',                   'chalkboard',     'matt',     9,                    2,                 130,             4,                  'Writable surface; sand between coats.'),
  ('EMR Shielding',                       'emr_shielding',  'matt',     5,                    2,                 350,             4,                  'Carbon/nickel pigment; needs grounding.');
