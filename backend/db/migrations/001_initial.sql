-- 001_initial.sql — users, painter_profiles, bookings, reviews
-- Mirrors the original database.js schema so existing data still loads.

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  phone       TEXT    NOT NULL UNIQUE,
  email       TEXT    UNIQUE,
  password    TEXT    NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'customer',     -- customer | painter | admin
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS painter_profiles (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL UNIQUE,
  city               TEXT    NOT NULL DEFAULT '',
  area               TEXT,
  bio                TEXT,
  experience_years   INTEGER DEFAULT 0,
  rate_per_day       REAL    NOT NULL DEFAULT 200,
  services           TEXT    NOT NULL DEFAULT '[]',    -- JSON array
  materials_included INTEGER DEFAULT 0,
  verified           INTEGER DEFAULT 0,
  avatar_color       TEXT    DEFAULT '#16a085',
  avatar_url         TEXT,
  avg_rating         REAL    DEFAULT 0,
  review_count       INTEGER DEFAULT 0,
  suspended_at       TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
  id              TEXT    PRIMARY KEY,
  customer_id     INTEGER NOT NULL,
  painter_id      INTEGER NOT NULL,
  service         TEXT    NOT NULL,
  address         TEXT    NOT NULL,
  job_date        TEXT    NOT NULL,
  duration_days   INTEGER NOT NULL DEFAULT 1,
  area_sqm        REAL,
  notes           TEXT,
  subtotal        REAL    NOT NULL,
  platform_fee    REAL    NOT NULL,
  total           REAL    NOT NULL,
  payment_method  TEXT    NOT NULL DEFAULT 'momo',
  payment_status  TEXT    NOT NULL DEFAULT 'pending',
  status          TEXT    NOT NULL DEFAULT 'pending',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (painter_id)  REFERENCES painter_profiles(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id  TEXT    NOT NULL UNIQUE,
  painter_id  INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment     TEXT,
  hidden_at   TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id)  REFERENCES bookings(id),
  FOREIGN KEY (painter_id)  REFERENCES painter_profiles(id),
  FOREIGN KEY (customer_id) REFERENCES users(id)
);
