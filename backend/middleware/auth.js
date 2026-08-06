// ============================
// PaintGH — JWT Auth Middleware
// ============================

const jwt = require('jsonwebtoken');
const config = require('../config');

// Pulled from typed config — which throws at boot if JWT_SECRET is unset.
// We deliberately do NOT keep a hardcoded fallback: a missing/empty secret
// would silently let anyone forge tokens.
const JWT_SECRET = config.jwt.secret;

/**
 * Protect routes — verifies JWT token from Authorization header.
 * Attaches decoded user to req.user on success.
 */
function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, name, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
}

/**
 * Restrict to specific roles.
 * Usage: restrictTo('admin') or restrictTo('painter', 'admin')
 */
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires role: ${roles.join(' or ')}.`
      });
    }
    next();
  };
}

/**
 * Restrict to specific admin sub-roles. Always implies role='admin'.
 * super_admin matches every check by design (one bypass, one role).
 *
 * Usage: requireSubRole('dispatcher')
 *        requireSubRole('dispatcher', 'qa')
 */
function requireSubRole(...subRoles) {
  return (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }
    // sub_role is not in the JWT (so it can change without forcing re-login);
    // hydrate it from the DB once per request. Cheap — single indexed lookup.
    if (req.user.sub_role === undefined) {
      try {
        const db = require('../db');
        const row = db.prepare('SELECT sub_role FROM users WHERE id = ?').get(req.user.id);
        req.user.sub_role = row ? row.sub_role : null;
      } catch (_) {
        req.user.sub_role = null;
      }
    }
    if (req.user.sub_role === 'super_admin') return next();
    // Bootstrap: on a system that has no super_admin yet, treat any admin as
    // one. This lets a fresh install (or a manually-created admin who never
    // got a sub-role assigned) actually do dispatcher / QA / finance work
    // instead of hitting 403s with no obvious recovery path. The instant
    // someone earns an explicit super_admin sub-role, this bypass deactivates.
    if (!req.user.sub_role) {
      try {
        const db = require('../db');
        const hasSuper = db.prepare(
          `SELECT 1 FROM users WHERE role = 'admin' AND sub_role = 'super_admin' LIMIT 1`
        ).get();
        if (!hasSuper) return next();
      } catch (_) { /* fall through to the deny below */ }
    }
    if (!subRoles.includes(req.user.sub_role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires sub-role: ${subRoles.join(' or ')}.`
      });
    }
    next();
  };
}

module.exports = { protect, restrictTo, requireSubRole };
