// ============================
// routes/admin-users.js — admin-only user management.
//
// Why a separate file: this is the admin's view of every account on the
// platform — customers, painters, team members. The auth router
// (routes/auth.js) handles the user-FACING flows (login, register, change
// own password). This one is for dispatchers managing other people's
// accounts.
//
// Important: passwords are bcrypt-HASHED, not encrypted. We never expose
// the hash through the API and we never decrypt anything — the only
// password-write the admin can do is RESET to a new temp value (which the
// affected user must change on next sign-in via must_change_password).
// ============================

const express  = require('express');
const bcrypt   = require('bcryptjs');

const db          = require('../db');
const log         = require('../utils/logger');
const asyncHandler = require('../middleware/asyncHandler');
const { protect, restrictTo } = require('../middleware/auth');
const { notFound, badRequest } = require('../utils/errors');

const router = express.Router();

// Admin-only guard for everything in this file.
router.use(protect, restrictTo('admin'));

// Generate a memorable temporary password — three letters + four digits,
// no ambiguous characters. Same shape as pmUsers.generatePassword in
// shared.js so the two stores produce the same look-and-feel.
const TEMP_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TEMP_DIGITS  = '23456789';
function generateTempPassword() {
  let p = 'PM-';
  for (let i = 0; i < 3; i++) p += TEMP_LETTERS[Math.floor(Math.random() * TEMP_LETTERS.length)];
  p += '-';
  for (let i = 0; i < 4; i++) p += TEMP_DIGITS[Math.floor(Math.random() * TEMP_DIGITS.length)];
  return p;
}

// ─────────────────────────────────────────────
// GET /api/admin/users
// Returns every user. Filters: ?role=painter|customer|admin, ?search=...
// We map to a safe shape — never return the password column.
// ─────────────────────────────────────────────
router.get('/',
  asyncHandler(async (req, res) => {
    const filters = [];
    const params  = [];
    if (req.query.role) {
      filters.push('role = ?');
      params.push(String(req.query.role));
    }
    if (req.query.search) {
      filters.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      const q = '%' + String(req.query.search).replace(/%/g, '\\%') + '%';
      params.push(q, q, q);
    }
    const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
    const rows = db.prepare(`
      SELECT id, name, phone, email, role,
             must_change_password, last_sign_in_at, password_changed_at,
             created_at, updated_at
        FROM users
        ${where}
        ORDER BY role, name
    `).all(...params);

    res.json({
      success: true,
      count:   rows.length,
      users:   rows.map(safeUser),
    });
  })
);

// GET /api/admin/users/:id — one user, same shape.
router.get('/:id',
  asyncHandler(async (req, res) => {
    const row = db.prepare(`
      SELECT id, name, phone, email, role,
             must_change_password, last_sign_in_at, password_changed_at,
             created_at, updated_at
        FROM users WHERE id = ?
    `).get(req.params.id);
    if (!row) throw notFound('User not found.');
    res.json({ success: true, user: safeUser(row) });
  })
);

// ─────────────────────────────────────────────
// POST /api/admin/users/:id/reset-password
// Admin issues a fresh temporary password. Returns it ONCE in the response
// (so the dispatcher can copy it / SMS it to the user). The temp pass is
// hashed before storage; must_change_password flips to 1 so the user
// rotates it on next sign-in.
// ─────────────────────────────────────────────
router.post('/:id/reset-password',
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT id, name, phone FROM users WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('User not found.');

    // Allow admin to specify a custom temp pass, otherwise generate one.
    const tempPwd = req.body && req.body.password ? String(req.body.password) : generateTempPassword();
    if (tempPwd.length < 6) throw badRequest('Password must be at least 6 characters.');

    const hashed = bcrypt.hashSync(tempPwd, 12);
    db.prepare(`
      UPDATE users
         SET password = ?,
             must_change_password = 1,
             updated_at = datetime('now'),
             password_changed_at = datetime('now')
       WHERE id = ?
    `).run(hashed, req.params.id);

    log.info({ admin: req.user.id, target: row.id, name: row.name }, 'admin reset user password');
    res.json({
      success: true,
      message: `Temporary password issued for ${row.name}.`,
      user_id: row.id,
      // Returned ONCE so the dispatcher can hand it over. Don't log this.
      temporary_password: tempPwd,
      sms_template: `Hi ${row.name.split(' ')[0]} — your Paint Masters temporary password is ${tempPwd}. Sign in at paintmasters.gh and you'll be asked to set a permanent one.`,
    });
  })
);

// ─────────────────────────────────────────────
// PATCH /api/admin/users/:id
// Admin edits user metadata (name / phone / email / role / region).
// Never accepts password — that path goes through reset-password.
// ─────────────────────────────────────────────
router.patch('/:id',
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('User not found.');

    const allowed = ['name', 'phone', 'email', 'role'];
    const sets = [];
    const params = [];
    for (const k of allowed) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, k)) {
        sets.push(`${k} = ?`);
        params.push(req.body[k]);
      }
    }
    if (!sets.length) throw badRequest('Nothing to update.');
    params.push(req.params.id);
    db.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params);

    const updated = db.prepare(`
      SELECT id, name, phone, email, role,
             must_change_password, last_sign_in_at, password_changed_at, created_at, updated_at
        FROM users WHERE id = ?
    `).get(req.params.id);
    res.json({ success: true, user: safeUser(updated) });
  })
);

// Map a DB row to the API shape. The masked field surfaces enough info for
// the admin to reason about password state without exposing the bcrypt hash.
function safeUser(row) {
  return {
    id:    row.id,
    name:  row.name,
    phone: row.phone,
    email: row.email,
    role:  row.role,
    must_change_password: !!row.must_change_password,
    last_sign_in_at:      row.last_sign_in_at,
    password_changed_at:  row.password_changed_at,
    created_at:           row.created_at,
    updated_at:           row.updated_at,
    // Never the actual hash. The masked label tells the admin what's stored.
    password_status: row.must_change_password ? 'temp (must change)' : 'hashed (bcrypt)',
  };
}

module.exports = router;
