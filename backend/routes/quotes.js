// ============================
// Quotes routes — saved quotes that can convert into bookings/contracts.
//
// The customer-facing quote.html computes a price client-side. On submit
// (quote.html → booking.html) the front-end POSTs here to persist a quote
// record. The request can optionally include `paintLines: [{ paint_product_id,
// area_sqm, coats }]`, in which case each line is also persisted via
// services/paintVolume.recordEstimate(), flipping the quote into
// volume_status='pending_review' atomically — the dispatcher review screen
// then picks it up.
//
// Endpoints:
//   POST   /api/quotes            create (anon or auth'd)
//   GET    /api/quotes            list (admin sees all; customer sees own)
//   GET    /api/quotes/:id        fetch one (with volume estimate lines)
//   PUT    /api/quotes/:id/finalize  guarded by paintVolume.assertVolumeConfirmed
// ============================

const express = require('express');
const { body, param } = require('express-validator');

const db            = require('../db');
const C             = require('../config/constants');
const validate      = require('../middleware/validate');
const asyncHandler  = require('../middleware/asyncHandler');
const { protect, restrictTo } = require('../middleware/auth');
const { calculateQuote } = require('../services/pricing');
const paintVolume   = require('../services/paintVolume');
const ids           = require('../utils/ids');
const { notFound, badRequest, forbidden } = require('../utils/errors');

const router = express.Router();

// ----- shared helpers ---------------------------------------------------

function enrichQuote(q) {
  if (!q) return null;
  const lines = paintVolume.listEstimates(q.id);
  return { ...q, paint_lines: lines };
}

function ensureUniqueId() {
  // ID collision is astronomically unlikely (8 chars from a 32-char alphabet)
  // but cheap to defend against. Retry until we find a free one.
  let id = ids.quoteId();
  while (db.prepare('SELECT 1 FROM quotes WHERE id = ?').get(id)) id = ids.quoteId();
  return id;
}

// ----- POST /api/quotes -------------------------------------------------
//
// Anonymous quotes are allowed (customer_id stays NULL). If the caller
// supplies `paintLines`, each is persisted via services/paintVolume so the
// quote enters 'pending_review' atomically. If the array is omitted or empty,
// the quote stays at the default 'pending_review' state set by migration 025
// — meaning every quote requires a dispatcher to confirm before finalize.
// Quote callers that DO want to skip the gate (e.g. an admin one-off) can
// pass `volume_required: false`, which switches to 'not_required'.
//
router.post('/', [
  body('service').notEmpty(),
  body('area_sqm').isFloat({ min: C.MIN_AREA_SQM, max: C.MAX_AREA_SQM }),
  body('duration_days').isInt({ min: C.MIN_DURATION_DAYS, max: C.MAX_DURATION_DAYS }),
  body('rate_per_day').isFloat({ min: C.MIN_RATE_PER_DAY, max: C.MAX_RATE_PER_DAY }),
  body('materials_included').optional().isBoolean(),
  body('painter_id').optional().isInt(),
  body('city').optional().isString().isLength({ max: 120 }),
  body('address').optional().isString().isLength({ max: 500 }),
  body('notes').optional().isString().isLength({ max: 1000 }),
  body('paintLines').optional().isArray(),
  body('volume_required').optional().isBoolean(),
], validate, asyncHandler(async (req, res) => {
  const {
    service, area_sqm, duration_days, rate_per_day,
    materials_included = false,
    painter_id = null, city = null, address = null, notes = null,
    paintLines = [],
    volume_required = true,
  } = req.body;

  const calc = calculateQuote({
    service, area_sqm, duration_days, rate_per_day,
    materials_included,
  });

  const id        = ensureUniqueId();
  const expires   = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  const customer  = req.user && req.user.role === 'customer' ? req.user.id : null;
  const initialVolumeStatus = volume_required ? 'pending_review' : 'not_required';

  // Atomic: insert the quote, then attach any provided paint lines. We use
  // a transaction so a half-persisted quote can never be left behind.
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO quotes
        (id, customer_id, painter_id, service, area_sqm, duration_days,
         materials_included, city, address, notes,
         subtotal, platform_fee, total, pricing_breakdown, expires_at, volume_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, customer, painter_id, service, area_sqm, duration_days,
      materials_included ? 1 : 0, city, address, notes,
      calc.subtotal, calc.platform_fee, calc.total,
      JSON.stringify(calc.breakdown), expires, initialVolumeStatus,
    );

    const persistedLines = [];
    for (const line of paintLines) {
      if (!line || !line.paint_product_id || !line.area_sqm) continue;
      const rec = paintVolume.recordEstimate({
        quote_id: id,
        paint_product_id: line.paint_product_id,
        surface_area_sqm: line.area_sqm,
        coats: line.coats,
        notes: line.notes || null,
        created_by: customer,
      });
      persistedLines.push(rec);
    }
    return persistedLines;
  });
  const persistedLines = tx();

  const saved = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);
  res.status(201).json({
    success: true,
    message: persistedLines.length
      ? `Quote ${id} created. ${persistedLines.length} paint line(s) queued for dispatcher review.`
      : `Quote ${id} created.`,
    quote: enrichQuote(saved),
    pricing: calc.breakdown,
    persisted_paint_lines: persistedLines.length,
  });
}));

// ----- GET /api/quotes --------------------------------------------------
router.get('/', protect, asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(C.MAX_PAGE_SIZE, parseInt(req.query.limit || String(C.DEFAULT_PAGE_SIZE), 10));
  const offset = (page - 1) * limit;

  const where  = [];
  const params = [];
  if (req.user.role === 'customer') {
    where.push('customer_id = ?');
    params.push(req.user.id);
  }
  if (req.query.volume_status) {
    where.push('volume_status = ?');
    params.push(req.query.volume_status);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM quotes ${whereSql}`).get(...params).n;
  const rows  = db.prepare(`
    SELECT * FROM quotes ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    success: true,
    total, page, pages: Math.ceil(total / limit),
    quotes: rows.map(enrichQuote),
  });
}));

// ----- GET /api/quotes/:id ----------------------------------------------
router.get('/:id', protect, [ param('id').isString().notEmpty() ], validate,
  asyncHandler(async (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) throw notFound(`Quote ${req.params.id} not found.`);
    if (req.user.role !== 'admin' && quote.customer_id !== req.user.id) {
      // Anonymous quotes (customer_id=null) are visible to any authenticated
      // user who has the ID, by design — the URL acts as a bearer token for
      // the quote until it's claimed.
      if (quote.customer_id !== null) throw forbidden('Access denied.');
    }
    res.json({ success: true, quote: enrichQuote(quote) });
  })
);

// ----- PUT /api/quotes/:id/finalize ------------------------------------
//
// The gate. Throws 400 if volume hasn't been confirmed. Once finalized we
// stamp converted_booking_id later when the booking is actually created —
// for now this endpoint just asserts the quote is ready to convert.
router.put('/:id/finalize', protect, restrictTo('admin'),
  [ param('id').isString().notEmpty() ], validate,
  asyncHandler(async (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) throw notFound(`Quote ${req.params.id} not found.`);
    if (quote.converted_booking_id) {
      throw badRequest(`Quote already converted to booking ${quote.converted_booking_id}.`);
    }
    paintVolume.assertVolumeConfirmed(req.params.id);   // <-- the gate

    // We don't set converted_booking_id here — that happens when bookings.js
    // creates the booking and links back. The success response just confirms
    // the gate has cleared.
    res.json({
      success: true,
      message: `Quote ${req.params.id} is ready to convert into a booking.`,
      quote: enrichQuote(quote),
    });
  })
);

module.exports = router;
