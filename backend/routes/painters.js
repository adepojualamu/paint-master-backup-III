// ============================
// Painters routes — public listing/profile + painter self-service.
// ============================

const express = require('express');
const { body } = require('express-validator');

const db          = require('../db');
const C           = require('../config/constants');
const validate    = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { protect, restrictTo } = require('../middleware/auth');
const { notFound, badRequest } = require('../utils/errors');

const router = express.Router();

function parsePainter(p) {
  if (!p) return null;
  return {
    ...p,
    services: JSON.parse(p.services || '[]'),
    materials_included: !!p.materials_included,
    verified: !!p.verified,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { city, service, min_rating = 0, max_rate = 99999 } = req.query;
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(C.MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit || String(C.DEFAULT_PAGE_SIZE), 10)));
  const offset = (page - 1) * limit;

  const whereParts  = ['pp.avg_rating >= ?', 'pp.rate_per_day <= ?', 'pp.suspended_at IS NULL'];
  const whereParams = [parseFloat(min_rating), parseFloat(max_rate)];
  if (city)    { whereParts.push('pp.city = ?');         whereParams.push(city); }
  if (service) { whereParts.push('pp.services LIKE ?');  whereParams.push(`%"${service}"%`); }
  const whereSql = 'WHERE ' + whereParts.join(' AND ');

  const dataSql = `
    SELECT pp.id, pp.city, pp.area, pp.bio, pp.experience_years, pp.rate_per_day,
           pp.services, pp.materials_included, pp.verified, pp.avatar_color, pp.avatar_url,
           pp.avg_rating, pp.review_count, pp.created_at,
           u.name, u.phone, u.email
      FROM painter_profiles pp JOIN users u ON u.id = pp.user_id
      ${whereSql}
     ORDER BY pp.avg_rating DESC, pp.review_count DESC
     LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS n FROM painter_profiles pp JOIN users u ON u.id = pp.user_id ${whereSql}`;

  const rows  = db.prepare(dataSql).all(...whereParams, limit, offset);
  const total = db.prepare(countSql).get(...whereParams).n;

  res.json({ success: true, total, page, pages: Math.ceil(total / limit), painters: rows.map(parsePainter) });
}));

router.get('/me', protect, restrictTo('painter'), asyncHandler(async (req, res) => {
  const profile = db.prepare(`
    SELECT pp.*, u.name, u.phone, u.email FROM painter_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.user_id = ?
  `).get(req.user.id);
  if (!profile) throw notFound('Painter profile not found.');
  const reviews = db.prepare(`
    SELECT r.*, u.name AS customer_name FROM reviews r JOIN users u ON u.id = r.customer_id
     WHERE r.painter_id = ? AND r.hidden_at IS NULL ORDER BY r.created_at DESC
  `).all(profile.id);
  const photos = db.prepare(`SELECT id, url, caption, position FROM painter_photos WHERE painter_id = ? ORDER BY position, id`).all(profile.id);
  res.json({ success: true, painter: parsePainter(profile), reviews, photos });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const profile = db.prepare(`
    SELECT pp.*, u.name, u.phone, u.email FROM painter_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.id = ?
  `).get(req.params.id);
  if (!profile) throw notFound('Painter not found.');
  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, u.name AS customer_name
      FROM reviews r JOIN users u ON u.id = r.customer_id
     WHERE r.painter_id = ? AND r.hidden_at IS NULL ORDER BY r.created_at DESC LIMIT 20
  `).all(profile.id);
  const photos = db.prepare(`SELECT id, url, caption, position FROM painter_photos WHERE painter_id = ? ORDER BY position, id LIMIT 12`).all(profile.id);
  res.json({ success: true, painter: parsePainter(profile), reviews, photos });
}));

router.put('/profile', protect, restrictTo('painter'), [
  body('city').optional().trim(),
  body('rate_per_day').optional().isFloat({ min: C.MIN_RATE_PER_DAY, max: C.MAX_RATE_PER_DAY }),
  body('services').optional().isArray(),
], validate, asyncHandler(async (req, res) => {
  const profile = db.prepare('SELECT * FROM painter_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile) throw notFound('Painter profile not found.');

  const { city, area, bio, experience_years, rate_per_day, services, materials_included, avatar_color, avatar_url } = req.body;
  db.prepare(`
    UPDATE painter_profiles SET
      city               = COALESCE(?, city),
      area               = COALESCE(?, area),
      bio                = COALESCE(?, bio),
      experience_years   = COALESCE(?, experience_years),
      rate_per_day       = COALESCE(?, rate_per_day),
      services           = COALESCE(?, services),
      materials_included = COALESCE(?, materials_included),
      avatar_color       = COALESCE(?, avatar_color),
      avatar_url         = COALESCE(?, avatar_url),
      updated_at         = datetime('now')
     WHERE user_id = ?
  `).run(
    city ?? null, area ?? null, bio ?? null,
    experience_years ?? null, rate_per_day ?? null,
    services ? JSON.stringify(services) : null,
    materials_included !== undefined ? (materials_included ? 1 : 0) : null,
    avatar_color ?? null, avatar_url ?? null,
    req.user.id,
  );
  if (req.body.name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(req.body.name, req.user.id);

  const updated = db.prepare(`
    SELECT pp.*, u.name, u.phone, u.email FROM painter_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.user_id = ?
  `).get(req.user.id);
  res.json({ success: true, message: 'Profile updated.', painter: parsePainter(updated) });
}));

// ─────────────────────────────────────────────────────────────
// Admin-only: remove (soft-suspend) a Paint Master from the roster.
//
// We don't hard-delete because painter_id is referenced by bookings,
// reviews, payments, etc. Suspension sets suspended_at and the public
// listing endpoint (router.get('/') above) already filters them out via
// "pp.suspended_at IS NULL" — so a suspended painter immediately
// disappears from customer-facing search but the audit trail survives.
// ─────────────────────────────────────────────────────────────
router.put('/:id/suspend', protect, restrictTo('admin'),
  asyncHandler(async (req, res) => {
    const painter = db.prepare('SELECT id, suspended_at FROM painter_profiles WHERE id = ?').get(req.params.id);
    if (!painter) throw notFound(`Painter profile ${req.params.id} not found.`);
    if (painter.suspended_at) {
      return res.json({ success: true, message: `Painter ${req.params.id} is already suspended.`, suspended_at: painter.suspended_at });
    }
    db.prepare("UPDATE painter_profiles SET suspended_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    const updated = db.prepare('SELECT suspended_at FROM painter_profiles WHERE id = ?').get(req.params.id);
    res.json({
      success: true,
      message: `Painter ${req.params.id} removed from the roster.`,
      suspended_at: updated.suspended_at,
    });
  })
);

router.put('/:id/reinstate', protect, restrictTo('admin'),
  asyncHandler(async (req, res) => {
    const painter = db.prepare('SELECT id, suspended_at FROM painter_profiles WHERE id = ?').get(req.params.id);
    if (!painter) throw notFound(`Painter profile ${req.params.id} not found.`);
    if (!painter.suspended_at) {
      return res.json({ success: true, message: `Painter ${req.params.id} is already active.` });
    }
    db.prepare("UPDATE painter_profiles SET suspended_at = NULL, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: `Painter ${req.params.id} reinstated to the roster.` });
  })
);

// ─────────────────────────────────────────────────────────────
// PATCH /api/painters/:id — admin updates a painter's profile.
// Whitelisted fields only; never accepts password (that goes through
// /api/admin/users/:id/reset-password) and never lets the admin re-id a row.
// Used by admin/artisans.html's Edit Painter form.
// ─────────────────────────────────────────────────────────────
router.patch('/:id', protect, restrictTo('admin'),
  asyncHandler(async (req, res) => {
    const painter = db.prepare('SELECT id, user_id FROM painter_profiles WHERE id = ?').get(req.params.id);
    if (!painter) throw notFound(`Painter profile ${req.params.id} not found.`);

    // Whitelist what an admin can touch. Anything not in this list is dropped.
    const PROFILE_FIELDS = ['city', 'area', 'bio', 'experience_years', 'rate_per_day',
                            'materials_included', 'avatar_color'];
    const USER_FIELDS    = ['name', 'phone', 'email'];

    const profileSets = []; const profileParams = [];
    for (const k of PROFILE_FIELDS) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, k)) {
        profileSets.push(`${k} = ?`);
        profileParams.push(req.body[k]);
      }
    }
    // `services` is JSON-encoded in storage; accept either an array or a JSON string.
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'services')) {
      profileSets.push('services = ?');
      const s = req.body.services;
      profileParams.push(typeof s === 'string' ? s : JSON.stringify(s || []));
    }

    const userSets = []; const userParams = [];
    for (const k of USER_FIELDS) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, k)) {
        userSets.push(`${k} = ?`);
        userParams.push(req.body[k]);
      }
    }

    if (!profileSets.length && !userSets.length) {
      throw badRequest('Nothing to update — supply at least one whitelisted field.');
    }

    db.transaction(() => {
      if (profileSets.length) {
        profileParams.push(req.params.id);
        db.prepare(
          `UPDATE painter_profiles SET ${profileSets.join(', ')}, updated_at = datetime('now') WHERE id = ?`
        ).run(...profileParams);
      }
      if (userSets.length) {
        userParams.push(painter.user_id);
        db.prepare(
          `UPDATE users SET ${userSets.join(', ')}, updated_at = datetime('now') WHERE id = ?`
        ).run(...userParams);
      }
    })();

    const refreshed = db.prepare(`
      SELECT pp.id, pp.user_id, pp.city, pp.area, pp.bio, pp.experience_years,
             pp.rate_per_day, pp.materials_included, pp.services, pp.avatar_color,
             pp.avg_rating, pp.review_count, pp.suspended_at,
             u.name, u.phone, u.email, u.role
        FROM painter_profiles pp JOIN users u ON u.id = pp.user_id
       WHERE pp.id = ?
    `).get(req.params.id);
    if (refreshed) {
      try { refreshed.services = JSON.parse(refreshed.services || '[]'); } catch (_) { refreshed.services = []; }
    }

    res.json({ success: true, message: `Painter ${req.params.id} updated.`, painter: refreshed });
  })
);

module.exports = router;
