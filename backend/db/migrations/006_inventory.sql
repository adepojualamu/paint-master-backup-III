-- 006_inventory.sql — paint stock + suppliers + purchase orders.
-- Backs the admin dashboard inventory page.

CREATE TABLE IF NOT EXISTS suppliers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  contact     TEXT,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sku             TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  category        TEXT,                          -- paint | primer | brush | roller | tape | ...
  unit            TEXT    NOT NULL DEFAULT 'unit',  -- L, kg, piece
  unit_cost       REAL    NOT NULL DEFAULT 0,
  stock_qty       REAL    NOT NULL DEFAULT 0,
  reorder_level   REAL    NOT NULL DEFAULT 0,
  preferred_supplier_id INTEGER,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (preferred_supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id  INTEGER NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'draft',  -- draft | sent | received | cancelled
  total        REAL    NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   INTEGER,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  received_at  TEXT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (created_by)  REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id     INTEGER NOT NULL,
  item_id   INTEGER NOT NULL,
  qty       REAL    NOT NULL,
  unit_cost REAL    NOT NULL,
  FOREIGN KEY (po_id)   REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id)
);

CREATE TABLE IF NOT EXISTS material_usage (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id  TEXT    NOT NULL,
  item_id     INTEGER NOT NULL,
  qty         REAL    NOT NULL,
  used_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (item_id)    REFERENCES inventory_items(id)
);
