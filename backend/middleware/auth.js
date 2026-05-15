// ============================
// PaintGH — JWT Auth Middleware
// ============================

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'paintgh_dev_secret';

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
