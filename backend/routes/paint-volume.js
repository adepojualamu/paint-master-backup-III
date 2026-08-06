// ============================
// Paint volume routes — the gate that sits between a quote being drafted
// and a contract being signed.
//
//   POST   /api/paint-volume/quotes/:id/estimates    add a volume line
//   GET    /api/paint-volume/quotes/:id              list lines + status
//   POST   /api/paint-volume/quotes/:id/confirm      dispatcher signs off
//   POST   /api/paint-volume/quotes/:id/reject       dispatcher rejects
//   GET    /api/paint-volume/products                list active paint products
//   POST   /api/paint-volume/preview                 stateless "what would this cost?" calc
// ============================

const express = require('express');
const { body, param } = require('express-validator');

const db            = require('../db');
const C             = require('../config/constants');
const validate      = require('../middleware/validate');
const asyncHandler  = require('../middleware/asyncHandler');
const { protect, restrictTo, requireSubRole } = require('../middleware/auth');
const paintVolume   = require('../services/paintVolume');
const notifications = require('../services/notifications');
const { notFound }  = require('../utils/errors');

const router = express.Router();

// ----- catalog -----
router.get('/products', asyncHandler(async (req, res) => {
  const { type } = req.query;
  const where = ['active = 1'];
  const params = [];
  if (type) { where.push('type = ?'); params.push(type); }
  const products = db.prepare(`
    SELECT id, name, type, brand, finish, coverage_m2_per_litre,
           coats_recommended, price_per_litre, bucket_size_litres
      FROM paint_products
     WHERE ${where.join(' AND ')}
     ORDER BY type, name
  `).all(...params);
  res.json({ success: true, products });
}));

// ----- stateless preview (no DB writes — useful for the customer's quote form) -----
router.post('/preview', [
  body('paint_product_id').isInt(),
  body('surface_area_sqm').isFloat({ min: C.MIN_AREA_SQM, max: C.MAX_AREA_SQM }),
  body('coats').optional().isInt({ min: 1, max: 5 }),
], validate, asyncHandler(async (req, res) => {
  const { paint_product_id, surface_area_sqm, coats } = req.body;
  const result = paintVolume.estimateForProduct({ paint_product_id, surface_area_sqm, coats });
  res.json({ success: true, preview: result });
}));

// ----- per-quote: add a line -----
router.post('/quotes/:id/estimates', protect, [
  param('id').isString().notEmpty(),
  body('paint_product_id').isInt(),
  body('surface_area_sqm').isFloat({ min: C.MIN_AREA_SQM, max: C.MAX_AREA_SQM }),
  body('coats').optional().isInt({ min: 1, max: 5 }),
  body('notes').optional().isString().isLength({ max: 500 }),
], validate, asyncHandler(async (req, res) => {
  const { paint_product_id, surface_area_sqm, coats, notes } = req.body;
  const result = paintVolume.recordEstimate({
    quote_id: req.params.id,
    paint_product_id,
    surface_area_sqm,
    coats,
    notes,
    created_by: req.user.id,
  });
  res.status(201).json({ success: true, estimate: result });
}));

// ----- per-quote: list lines + current status -----
router.get('/quotes/:id', protect, asyncHandler(async (req, res) => {
  const quote = db.prepare(
    'SELECT id, volume_status, volume_confirmed_by, volume_confirmed_at FROM quotes WHERE id = ?'
  ).get(req.params.id);
  if (!quote) throw notFound(`Quote ${req.params.id} not found.`);
  const lines = paintVolume.listEstimates(req.params.id);
  const totals = lines.reduce((acc, l) => ({
    litres:  acc.litres  + (l.litres_needed  || 0),
    buckets: acc.buckets + (l.buckets_needed || 0),
    cost:    acc.cost    + (l.cost_estimate  || 0),
  }), { litres: 0, buckets: 0, cost: 0 });
  res.json({ success: true, quote, lines, totals });
}));

// ----- per-quote: confirm (dispatcher or super_admin) -----
router.post('/quotes/:id/confirm', protect, restrictTo('admin'),
  requireSubRole('dispatcher'),
  asyncHandler(async (req, res) => {
    const result = paintVolume.confirm({ quote_id: req.params.id, user_id: req.user.id });
    try {
      const customer = db.prepare(`
        SELECT u.id, u.name, u.phone, u.email
          FROM quotes q LEFT JOIN users u ON u.id = q.customer_id
         WHERE q.id = ?
      `).get(req.params.id);
      if (customer) notifications.emit('volume.confirmed', { quote_id: req.params.id, customer });
    } catch (_) {}
    res.json({ success: true, ...result });
  })
);

// ----- per-quote: reject (dispatcher or super_admin) -----
router.post('/quotes/:id/reject', protect, restrictTo('admin'),
  requireSubRole('dispatcher'),
  [ body('reason').optional().isString().isLength({ max: 500 }) ],
  validate,
  asyncHandler(async (req, res) => {
    const result = paintVolume.reject({
      quote_id: req.params.id,
      user_id:  req.user.id,
      reason:   req.body.reason,
    });
    try {
      const customer = db.prepare(`
        SELECT u.id, u.name, u.phone, u.email
          FROM quotes q LEFT JOIN users u ON u.id = q.customer_id
         WHERE q.id = ?
      `).get(req.params.id);
      if (customer) notifications.emit('volume.rejected', {
        quote_id: req.params.id,
        customer,
        reason: req.body.reason,
      });
    } catch (_) {}
    res.json({ success: true, ...result });
  })
);

module.exports = router;
