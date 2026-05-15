-- 013_composite_indexes.sql — composite/covering indexes for the queries
-- the admin dashboard will actually run at scale. Each index is paired with
-- the route or report that benefits from it.

-- Job Board: GET /api/bookings?status=...&painter_id=... ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS ix_bookings_status_painter_created
  ON bookings(status, painter_id, created_at DESC);

-- Customer dashboard: GET /api/bookings?customer_id=... ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS ix_bookings_customer_created
  ON bookings(customer_id, created_at DESC);

-- Analytics: revenue-by-day query joins bookings on (created_at, status)
CREATE INDEX IF NOT EXISTS ix_bookings_created_status
  ON bookings(date(created_at), status);

-- Painters listing: filter by city + min_rating + max_rate, ORDER BY rating
CREATE INDEX IF NOT EXISTS ix_painters_city_rate_rating
  ON painter_profiles(city, rate_per_day, avg_rating DESC)
  WHERE suspended_at IS NULL;

-- Reviews tab: hide soft-deleted, order by date
CREATE INDEX IF NOT EXISTS ix_reviews_painter_created
  ON reviews(painter_id, created_at DESC)
  WHERE hidden_at IS NULL;

-- Job Board photo gallery: photos by booking + kind
CREATE INDEX IF NOT EXISTS ix_job_photos_booking_kind
  ON job_photos(booking_id, kind, created_at);

-- Audit log lookups: by entity for "show me the history of this booking"
CREATE INDEX IF NOT EXISTS ix_audit_entity
  ON audit_log(entity_type, entity_id, created_at DESC);

-- Payment events for webhook replay (column on payment_events is received_at,
-- not created_at — kept that way because payment_events is an append-only
-- log of incoming webhook payloads, "received" is the more accurate verb).
CREATE INDEX IF NOT EXISTS ix_payment_events_payment
  ON payment_events(payment_id, received_at);
