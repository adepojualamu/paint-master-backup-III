-- 029_quote_photos.sql
-- Customer-uploaded photos of the space to be painted, attached to a QUOTE.
-- Captured while the customer finalizes the quote (before any booking exists),
-- so they hang off quote_id rather than booking_id. The dispatcher reviews
-- them during the volume gate; the assigned painter sees them as part of the
-- job brief. Files live on disk under UPLOADS_LOCAL_DIR/quote-photos/<quoteId>/;
-- this table holds the metadata.

CREATE TABLE IF NOT EXISTS quote_photos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id      TEXT    NOT NULL,
  filename      TEXT    NOT NULL,            -- on-disk filename (sha256 + ext)
  original_name TEXT    NOT NULL,            -- the customer's original filename
  mime_type     TEXT    NOT NULL,
  size_bytes    INTEGER NOT NULL,
  storage_path  TEXT    NOT NULL,            -- relative to UPLOADS_LOCAL_DIR
  caption       TEXT,                        -- optional, customer-supplied
  uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_quote_photos_quote ON quote_photos(quote_id);
