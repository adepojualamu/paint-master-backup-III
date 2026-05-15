// ============================
// Bookings routes — uses services/pricing for the canonical quote calc and
// services/availability for multi-day conflict detection.
// ============================

const express = require('express');
const { body } = require('express-validator');

const db          = require('../db');
const C           = require('../config/constants');
const validate    = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { protect, restrictTo } = require('../middleware/auth');
const { calculateQuote, calculateRefund } = require('../services/pricing');
const availability = require('../services/availability');
const ids         = require('../utils/ids');
const { isFutureDate } = require('../utils/dates');
const { notFound, badRequest, conflict, forbidden } = require('../utils/errors');

const router = express.Router();

function enrichBooking(b) {
  if (!b) return null;
  const painter  = db.prepare(`
    SELECT u.name AS painter_name, pp.city, pp.rate_per_day
      FROM painter_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.id = ?
  `).get(b.painter_id);
  const customer = db.prepare('SELECT name, phone, email FROM users WHERE id = ?').get(b.customer_id);
  return { ...b,
    painter_name:    painter?.painter_name,
    painter_city:    painter?.city,
    customer_name:   customer?.name,
    customer_phone:  customer?.phone,
  };
}

router.post('/', protect, restrictTo('customer'), [
  body('painter_id').isInt(),
  body('service').notEmpty(),
  body('address').notEmpty(),
  body('job_date').isDate(),
  body('duration_days').isInt({ min: C.MIN_DURATION_DAYS, max: C.MAX_DURATION_DAYS }),
  body('area_sqm').isFloat({ min: C.MIN_AREA_SQM, max: C.MAX_AREA_SQM }),
  body('payment_method').isIn(C.PAYMENT_METHODS),
  body('materials_included').optional().isBoolean(),
], validate, asyncHandler(async (req, res) => {
  const { painter_id, service, address, job_date, duration_days, area_sqm, notes, payment_method } = req.body;
  const materials = !!req.body.materials_included;

  const painter = db.prepare('SELECT * FROM painter_profiles WHERE id = ?').get(painter_id);
  if (!painter) throw notFound('Painter not found.');
  if (!isFutureDate(job_date)) throw badRequest('Job date must be in the future.');

  const avail = availability.isPainterAvailable({ painterId: painter_id, startDate: job_date, durationDays: duration_days });
  if (!avail.available) throw conflict('Painter is not available for those dates.', { conflicts: avail.conflicts });

  const quote = calculateQuote({
    service, area_sqm, duration_days,
    rate_per_day: painter.rate_per_day,
    materials_included: materials,
  });

  // Generate a booking ID — collision-resistant via crypto.randomBytes; retry just in case.
  let bookingId = ids.bookingId();
  while (db.prepare('SELECT 1 FROM bookings WHERE id = ?').get(bookingId)) bookingId = ids.bookingId();

  db.prepare(`
    INSERT INTO bookings
      (id, customer_id, painter_id, service, address, job_date, duration_days, area_sqm, notes,
       subtotal, platform_fee, total, payment_method, payment_status, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')
  `).run(
    bookingId, req.user.id, painter_id, service, address, job_date, duration_days, area_sqm, notes || null,
    quote.subtotal, quote.platform_fee, quote.total, payment_method,
  );

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  res.status(201).json({
    success: true,
    message: `Booking ${bookingId} created. The painter will confirm within 2 hours.`,
    booking: enrichBooking(booking),
    quote: quote.breakdown,
  });
}));

router.get('/', protect, asyncHandler(async (req, res) => {
  const { status } = req.query;
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(C.MAX_PAGE_SIZE, parseInt(req.query.limit || String(C.DEFAULT_PAGE_SIZE), 10));
  const offset = (page - 1) * limit;

  const where = []; const params = [];
  if (req.user.role === 'customer') { where.push('customer_id = ?'); params.push(req.user.id); }
  else if (req.user.role === 'painter') {
    const profile = db.prepare('SELECT id FROM painter_profiles WHERE user_id = ?').get(req.user.id);
    if (!profile) throw notFound('Painter profile not found.');
    where.push('painter_id = ?'); params.push(profile.id);
  }
  // admin: no scope filter
  if (status) { where.push('status = ?'); params.push(status); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM bookings ${whereSql}`).get(...params).n;
  const rows  = db.prepare(`SELECT * FROM bookings ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), bookings: rows.map(enrichBooking) });
}));

router.get('/:id', protect, asyncHandler(async (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) throw notFound('Booking not found.');
  if (req.user.role !== 'admin') {
    const profile = req.user.role === 'painter'
      ? db.prepare('SELECT id FROM painter_profiles WHERE user_id = ?').get(req.user.id) : null;
    const isOwner = booking.customer_id === req.user.id || (profile && booking.painter_id === profile.id);
    if (!isOwner) throw forbidden('Access denied.');
  }
  const review = db.prepare('SELECT * FROM reviews WHERE booking_id = ?').get(req.params.id);
  const milestones = db.prepare('SELECT * FROM job_milestones WHERE booking_id = ? ORDER BY position, id').all(req.params.id);
  const photos = db.prepare('SELECT id, url, kind, caption, created_at FROM job_photos WHERE booking_id = ? ORDER BY created_at').all(req.params.id);
  res.json({ success: true, booking: enrichBooking(booking), review: review || null, milestones, photos });
}));

router.put('/:id/confirm', protect, restrictTo('painter'), asyncHandler(async (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) throw notFound('Booking not found.');
  const profile = db.prepare('SELECT id FROM painter_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile || booking.painter_id !== profile.id) throw forbidden('This booking is not assigned to you.');
  if (booking.status !== 'pending') throw badRequest(`Booking is already ${booking.status}.`);

  // NOTE: payment_status is NOT auto-flipped to 'paid' here. That now happens via
  // the Paystack webhook (routes/payments.js → POST /webhook). Confirming the
  // booking is independent of money having moved.
  db.prepare(`UPDATE bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ success: true, message: 'Booking confirmed.', booking_id: req.params.id, status: 'confirmed' });
}));

router.put('/:id/cancel', protect, asyncHandler(async (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) throw notFound('Booking not found.');
  if (['completed', 'cancelled'].includes(booking.status)) throw badRequest(`Booking cannot be cancelled (${booking.status}).`);

  const profile = req.user.role === 'painter' ? db.prepare('SELECT id FROM painter_profiles WHERE user_id = ?').get(req.user.id) : null;
  const isOwner = booking.customer_id === req.user.id || (profile && booking.painter_id === profile.id);
  if (req.user.role !== 'admin' && !isOwner) throw forbidden('Access denied.');

  const refund = calculateRefund({ total: booking.total, jobDateIso: booking.job_date });
  db.prepare(`UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  // The actual refund execution is handled by services/refunds.issue() — invoke when payments are wired.

  res.json({
    success: true,
    message: refund.eligible === 'full'
      ? `Booking cancelled. Full refund of GH₵${refund.amount} will be processed.`
      : `Booking cancelled. Partial refund of GH₵${refund.amount} (${refund.fee} cancellation fee).`,
    booking_id: req.params.id,
    status: 'cancelled',
    refund,
  });
}));

router.put('/:id/complete', protect, restrictTo('painter'), asyncHandler(async (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) throw notFound('Booking not found.');
  const profile = db.prepare('SELECT id FROM painter_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile || booking.painter_id !== profile.id) throw forbidden('This booking is not assigned to you.');
  if (booking.status !== 'confirmed' && booking.status !== 'in_progress') {
    throw badRequest('Only confirmed or in-progress bookings can be completed.');
  }
  db.prepare(`UPDATE bookings SET status = 'completed', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  const payout = (booking.total * C.PAINTER_PAYOUT_PCT).toFixed(2);
  res.json({
    success: true,
    message: `Job marked complete. Payment of GH₵${payout} will be released to your MoMo within 24 hours.`,
    booking_id: req.params.id, status: 'completed',
  });
}));

module.exports = router;
