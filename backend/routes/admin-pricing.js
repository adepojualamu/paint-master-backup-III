// ============================
// routes/admin-pricing.js — operator-editable pricing rate card.
//
// The rate card is the single source of truth for quote pricing (see
// services/pricing.js + services/rateCard.js). These endpoints let an admin
// read and edit it from the portal (admin/pricing.html). Restricted to the
// finance sub-role (super_admin bypasses via requireSubRole). Every change is
// validated against config/pricingSchema.js and written to the audit log.
//
//   GET  /api/admin/pricing   → schema + current values (grouped for the UI)
//   PUT  /api/admin/pricing   → validate + persist a batch of edits
// ============================

const express = require('express');

const C            = require('../config/constants');
const schema       = require('../config/pricingSchema');
const rateCard     = require('../services/rateCard');
const audit        = require('../services/audit');
const asyncHandler = require('../middleware/asyncHandler');
const { protect, restrictTo, requireSubRole } = require('../middleware/auth');
const { badRequest } = require('../utils/errors');

const router = express.Router();

// Pricing is finance-owned. super_admin passes via the requireSubRole bypass;
// on a fresh system with no super_admin yet, any admin passes (bootstrap).
router.use(protect, restrictTo('admin'), requireSubRole('finance'));

// ----- GET /api/admin/pricing ------------------------------------------
// Returns each editable setting with its current value, plus the metadata the
// admin form needs (label, type, bounds, help). Values come from the rate card
// (DB, with schema defaults merged underneath).
router.get('/', asyncHandler(async (req, res) => {
  const flat = rateCard.getFlatSettings();
  const settings = schema.SETTINGS.map(s => ({
    key: s.key,
    label: s.label,
    category: s.category,
    type: s.type,
    min: s.min,
    max: s.max,
    help: s.help,
    value: flat[s.key],
  }));
  res.json({ success: true, settings });
}));

// ----- PUT /api/admin/pricing ------------------------------------------
// Body: { settings: { "<key>": <number>, ... } } — a partial map; only the
// keys present are updated. Validation is all-or-nothing: if any value is out
// of range or unknown, nothing is written.
router.put('/', asyncHandler(async (req, res) => {
  const edits = req.body && req.body.settings;
  if (!edits || typeof edits !== 'object' || Array.isArray(edits)) {
    throw badRequest('Body must be { settings: { key: value, ... } }.');
  }

  const result = rateCard.updateSettings(edits, req.user.id);
  if (!result.ok) {
    throw badRequest('Invalid pricing values.', { errors: result.errors });
  }

  audit.record({
    action: 'pricing.update',
    entityType: 'pricing_settings',
    entityId: result.updated.join(','),
    actorId: req.user.id,
    actorRole: req.user.role,
    ip: req.ip,
    requestId: req.id,
    payload: JSON.stringify(edits),
  });

  // Return the fresh values so the UI can re-render from the source of truth.
  const flat = rateCard.getFlatSettings();
  const settings = schema.SETTINGS.map(s => ({ key: s.key, value: flat[s.key] }));
  res.json({ success: true, updated: result.updated, settings });
}));

module.exports = router;
