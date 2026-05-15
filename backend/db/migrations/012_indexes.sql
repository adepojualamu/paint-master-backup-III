-- 012_indexes.sql — performance indexes on commonly-filtered columns.
-- Safe to add late: SQLite builds these without locking write traffic.

CREATE INDEX IF NOT EXISTS ix_users_role             ON users(role);
CREATE INDEX IF NOT EXISTS ix_painter_profiles_city  ON painter_profiles(city);
CREATE INDEX IF NOT EXISTS ix_painter_profiles_rating ON painter_profiles(avg_rating);
CREATE INDEX IF NOT EXISTS ix_bookings_customer      ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS ix_bookings_painter       ON bookings(painter_id);
CREATE INDEX IF NOT EXISTS ix_bookings_status        ON bookings(status);
CREATE INDEX IF NOT EXISTS ix_bookings_job_date      ON bookings(job_date);
CREATE INDEX IF NOT EXISTS ix_reviews_painter        ON reviews(painter_id);
