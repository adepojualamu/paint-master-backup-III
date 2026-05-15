-- 023_admin_sub_roles.sql — granular admin functions.
--
-- The base role stays ('customer' | 'painter' | 'admin') so every existing
-- check across routes keeps working. For users with role='admin' we now
-- also carry a sub_role so we can restrict actions to a specific function.
--
-- Allowed sub_role values (enforced in code, not DB, so we can add new ones
-- without a schema change):
--   super_admin        — full access, includes assigning sub-roles to others
--   dispatcher         — schedules painters, confirms volume estimates, owns the job board
--   qa                 — reviews completed jobs, signs off on quality milestones
--   finance            — payments, refunds, payouts, invoices
--   inventory_manager  — paint stock, suppliers, purchase orders, product catalog
--
-- Customers and painters never have a sub_role.

ALTER TABLE users ADD COLUMN sub_role TEXT;   -- nullable; only set when role='admin'

CREATE INDEX IF NOT EXISTS ix_users_role_sub_role
  ON users(role, sub_role);
