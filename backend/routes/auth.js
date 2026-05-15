// ============================
// PaintGH — Auth Routes
// POST /api/auth/register
// POST /api/auth/login
// GET  /api/auth/me
// ============================

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db      = require('../database');
const { protect } = require('../middleware/auth');

const router  = express.Router();
const JWT_SECRET   = process.env.JWT_SECRET   || 'paintgh_dev_secret';
const JWT_EXPIRES  = process.env.JWT_EXPIRES_IN || '7d';

// Helper: sign token
function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// Helper: safe user (no password)
function safeUser(u) {
  const { password, ...rest } = u;
  return rest;
}

// ─────────────────────────────────────────
// POST /api/auth/register
// Body: { name, phone, email?, password, role? }
// ─────────────────────────────────────────
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['customer', 'painter']).withMessage('Role must be customer or painter'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, phone, email, password, role = 'customer' } = req.body;

  // Check if phone already exists
  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with this phone number already exists.' });
  }

  const hashed = bcrypt.hashSync(password, 12);

  const result = db.prepare(`
    INSERT INTO users (name, phone, email, password, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, phone, email || null, hashed, role);

  // If registering as painter, create blank profile
  if (role === 'painter') {
    db.prepare(`
      INSERT INTO painter_profiles (user_id, city, services)
      VALUES (?, '', '[]')
    `).run(result.lastInsertRowid);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = signToken(user);

  res.status(201).json({
    success: true,
    message: 'Account created successfully.',
    token,
    user: safeUser(user)
  });
});

// ─────────────────────────────────────────
// POST /api/auth/login
// Body: { phone, password }
// ─────────────────────────────────────────
router.post('/login', [
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('password').notEmpty().withMessage('Password is required'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { phone, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ success: false, message: 'Incorrect phone number or password.' });
  }

  const token = signToken(user);

  res.json({
    success: true,
    message: 'Login successful.',
    token,
    user: safeUser(user)
  });
});

// ─────────────────────────────────────────
// GET /api/auth/me  [protected]
// Returns the currently logged-in user
// ─────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  let profile = null;
  if (user.role === 'painter') {
    profile = db.prepare('SELECT * FROM painter_profiles WHERE user_id = ?').get(user.id);
    if (profile) profile.services = JSON.parse(profile.services || '[]');
  }

  res.json({ success: true, user: safeUser(user), profile });
});

// ─────────────────────────────────────────
// PUT /api/auth/password  [protected]
// Body: { currentPassword, newPassword }
// ─────────────────────────────────────────
router.put('/password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(req.body.currentPassword, user.password)) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }

  const hashed = bcrypt.hashSync(req.body.newPassword, 12);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);

  res.json({ success: true, message: 'Password updated successfully.' });
});

module.exports = router;
