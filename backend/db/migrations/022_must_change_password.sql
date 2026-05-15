-- 022_must_change_password.sql — force-rotation flag for admin-issued accounts.
--
-- When an admin creates a painter / team member via the roster modal or
-- resets an existing user's password, must_change_password flips to 1.
-- The customer-side change-password.html page reads this flag (via the
-- /api/auth/me endpoint or the pmAuth cached user) and routes the user
-- to the password-change form on next sign-in. The flag clears once
-- they've successfully set a new password.

ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_sign_in_at     TEXT;          -- updated on /api/auth/login success
ALTER TABLE users ADD COLUMN password_changed_at TEXT;          -- updated on /api/auth/password success

CREATE INDEX IF NOT EXISTS ix_users_role_must_change
  ON users(role, must_change_password);
