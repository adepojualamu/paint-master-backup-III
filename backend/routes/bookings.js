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
const { protect, restrictTo, requireSubRole } = require('../middleware/auth');
const { calculateQuote, calculateRefund } = require('../services/pricing');
const availability  = require('../services/availability');
const autoAssign    = require('../services/autoAssign');
const paintVolume   = require('../services/paintVolume');
const notifications = require('../services/notifications');
const audit         = require('../services/audit');
const ids         = require('../utils/ids');
const { isFutureDate } = require('../utils/dates');
const { notFound, badRequest, conflict, forbidden } = require('../utils/errors');

const router = express.Router();

function enrichBooking(b) {
  if (!b) return null;
  const painter  = db.prepare(`
    SELECT u.name AS painter_name, pp.city, pp.rate_per_day, pp.services
      FROM painter_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.id = ?
  `).get(b.painter_id);
  const customer = db.prepare('SELECT name, phone, email FROM users WHERE id = ?').get(b.customer_id);
  let painter_services = [];
  try { painter_services = painter ? JSON.parse(painter.services || '[]') : []; } catch (_) { painter_services = []; }
  return { ...b,
    painter_name:    painter?.painter_name,
    painter_city:    painter?.city,
    painter_services,
    customer_name:   customer?.name,
    customer_phone:  customer?.phone,
  };
}

// Build a {customer, painter} block for notifications.emit() given a booking
// row. Pulls phone + email which enrichBooking doesn't expose (it's used for
// API responses where we don't want PII in every payload). Either side can
// come back null — templates handle that gracefully by short-circuiting.
function notifyParties(booking) {
  const customer = booking.customer_id
    ? db.prepare('SELECT id, name, phone, email FROM users WHERE id = ?').get(booking.customer_id)
    : null;
  const painter  = booking.painter_id
    ? db.prepare(`
        SELECT u.id AS user_id, u.name, u.phone, u.email
          FROM painter_profiles pp JOIN users u ON u.id = pp.user_id
         WHERE pp.id = ?
      `).get(booking.painter_id)
    : null;
  return { customer, painter };
}

// POST /api/bookings
//
// Two creation paths share this handler:
//   1. Painter pre-assigned — painter_id present; recompute pricing + run
//      availability check + lands in status='pending' for painter to confirm.
//   2. Unassigned (customer-side booking.html flow) — quote_id present
//      instead. Pricing is pulled from the linked quote so the customer is
//      charged what they saw. Booking lands in status='pending_assignment'
//      waiting for a dispatcher.
router.post('/', protect, restrictTo('customer'), [
  body('painter_id').optional().isInt(),
  body('quote_id').optional().isString(),
  body('service').notEmpty(),
  body('address').notEmpty(),
  body('job_date').isDate(),
  body('duration_days').isInt({ min: C.MIN_DURATION_DAYS, max: C.MAX_DURATION_DAYS }),
  body('area_sqm').isFloat({ min: C.MIN_AREA_SQM, max: C.MAX_AREA_SQM }),
  body('payment_method').isIn(C.PAYMENT_METHODS),
  body('materials_included').optional().isBoolean(),
], validate, asyncHandler(async (req, res) => {
  const { painter_id = null, quote_id = null, service, address, job_date,
          duration_days, area_sqm, notes, payment_method } = req.body;
  const materials = true;   // always-on: materials are included on every job (see services/pricing.js)

  if (!isFutureDate(job_date)) throw badRequest('Job date must be in the future.');

  let labour, subtotal, platform_fee, total, quoteBreakdown;
  let bookingStatus = 'pending';

  if (painter_id != null) {
    const painter = db.prepare('SELECT * FROM painter_profiles WHERE id = ?').get(painter_id);
    if (!painter) throw notFound('Painter not found.');
    const avail = availability.isPainterAvailable({ painterId: painter_id, startDate: job_date, durationDays: duration_days });
    if (!avail.available) throw conflict('Painter is not available for those dates.', { conflicts: avail.conflicts });
    const q = calculateQuote({
      service, area_sqm, duration_days,
      rate_per_day: painter.rate_per_day,
      materials_included: materials,
    });
    labour = q.labour;
    subtotal = q.subtotal; platform_fee = q.platform_fee; total = q.total;
    quoteBreakdown = q.breakdown;
  } else if (quote_id) {
    // Unassigned: pull the price from the linked quote so the customer is
    // charged what they saw, not what the backend would recompute. We also
    // copy `labour` through so qa-approve can compute the payout from it.
    const q = db.prepare('SELECT id, customer_id, labour, subtotal, platform_fee, total, pricing_breakdown FROM quotes WHERE id = ?').get(quote_id);
    if (!q) throw notFound(`Quote ${quote_id} not found.`);
    if (q.customer_id != null && q.customer_id !== req.user.id) {
      throw forbidden('That quote belongs to another customer.');
    }
    labour = q.labour;
    subtotal = q.subtotal; platform_fee = q.platform_fee; total = q.total;
    try { quoteBreakdown = JSON.parse(q.pricing_breakdown || '{}'); } catch (_) { quoteBreakdown = {}; }
    bookingStatus = 'pending_assignment';
  } else {
    throw badRequest('Either painter_id or quote_id is required.');
  }

  let bookingId = ids.bookingId();
  while (db.prepare('SELECT 1 FROM bookings WHERE id = ?').get(bookingId)) bookingId = ids.bookingId();

  db.prepare(`
    INSERT INTO bookings
      (id, customer_id, painter_id, quote_id, service, address, job_date,
       duration_days, area_sqm, notes,
       labour, subtotal, platform_fee, total, payment_method, payment_status, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    bookingId, req.user.id, painter_id, quote_id, service, address, job_date,
    duration_days, area_sqm, notes || null,
    labour, subtotal, platform_fee, total, payment_method, bookingStatus,
  );

  // Back-link the quote → booking so we can find which booking came from a
  // given quote without scanning all rows.
  if (quote_id) {
    db.prepare('UPDATE quotes SET converted_booking_id = ? WHERE id = ?').run(bookingId, quote_id);
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

  // Fire-and-forget notification. Worker picks it up on the next tick.
  // Pre-assigned bookings get an immediate booking.assigned in addition to
  // booking.created so the painter knows right away.
  try {
    const parties = notifyParties(booking);
    notifications.emit('booking.created', { booking, ...parties });
    if (painter_id) notifications.emit('booking.assigned', { booking, ...parties });
  } catch (_) { /* never fail the booking on a notification hiccup */ }

  // Auto-assignment: for unassigned (customer-side) bookings, immediately try
  // to propose the best available painter. Success moves the booking to
  // 'pending_approval' (painter attached but NOT notified) for a dispatcher to
  // approve. If no one is free right now it stays 'pending_assignment' and the
  // background sweep (services/autoAssign.start) will retry later. Non-fatal —
  // a hiccup here must never fail the booking the customer just paid for.
  let autoProposed = false;
  if (!painter_id) {
    try {
      const out = autoAssign.autoAssignBooking(bookingId, { actorId: req.user.id });
      autoProposed = out.assigned === true;
    } catch (_) { /* leave it in the manual queue */ }
  }

  const finalBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

  res.status(201).json({
    success: true,
    message: painter_id
      ? `Booking ${bookingId} created. The painter will confirm within 2 hours.`
      : autoProposed
        ? `Booking ${bookingId} received. A Paint Master has been proposed and is awaiting dispatcher approval.`
        : `Booking ${bookingId} received. A dispatcher will assign a Paint Master shortly.`,
    booking: enrichBooking(finalBooking),
    quote: quoteBreakdown,
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
  // Customer space photos attached to the linked quote. These were uploaded
  // during the quote flow so the dispatcher and the painter could see the
  // task ahead before arriving on site. Defensive try/catch so a booking
  // still serves if the quote_photos migration hasn't run yet.
  let quote_photos = [];
  if (booking.quote_id) {
    try {
      quote_photos = db.prepare(`
        SELECT id, original_name, mime_type, size_bytes, caption, uploaded_at
          FROM quote_photos WHERE quote_id = ? ORDER BY id
      `).all(booking.quote_id).map(p => ({ ...p, url: `/api/quotes/${booking.quote_id}/photos/${p.id}` }));
    } catch (_) { quote_photos = []; }
  }
  res.json({ success: true, booking: enrichBooking(booking), review: review || null, milestones, photos, quote_photos });
}));

// PUT /api/bookings/:id/assign
//
// Dispatcher hands a booking to a specific Paint Master — either from the
// manual "unassigned" queue (status='pending_assignment') or by overriding an
// auto-proposal (status='pending_approval'). Because a dispatcher is making the
// choice explicitly, this skips the approval gate: the booking moves straight
// to status='pending' and the painter is notified. assignment_mode='manual'.
// Validates the painter exists, isn't suspended, and is available for the dates.
//
// Allowed sub-roles: dispatcher (super_admin bypasses requireSubRole).
const REASSIGNABLE_STATUSES = ['pending_assignment', 'pending_approval'];
router.put('/:id/assign', protect, restrictTo('admin'),
  requireSubRole('dispatcher'),
  [ body('painter_id').isInt() ], validate,
  asyncHandler(async (req, res) => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) throw notFound('Booking not found.');
    if (!REASSIGNABLE_STATUSES.includes(booking.status)) {
      throw badRequest(
        `Booking ${req.params.id} is ${booking.status} — only unassigned or awaiting-approval bookings can be (re)assigned through this endpoint.`
      );
    }

    const painter = db.prepare(`
      SELECT pp.id, pp.suspended_at, u.name AS painter_name
        FROM painter_profiles pp
        JOIN users u ON u.id = pp.user_id
       WHERE pp.id = ?
    `).get(req.body.painter_id);
    if (!painter) throw notFound(`Painter ${req.body.painter_id} not found.`);
    if (painter.suspended_at) throw badRequest(`${painter.painter_name} is suspended from the roster.`);

    const avail = availability.isPainterAvailable({
      painterId:    painter.id,
      startDate:    booking.job_date,
      durationDays: booking.duration_days,
      excludeBookingId: booking.id,   // an in-place reassign shouldn't conflict with itself
    });
    if (!avail.available) {
      throw conflict(
        `${painter.painter_name} isn't available for ${booking.job_date} (+${booking.duration_days} day${booking.duration_days === 1 ? '' : 's'}).`,
        { conflicts: avail.conflicts }
      );
    }

    db.prepare(`
      UPDATE bookings
         SET painter_id = ?, status = 'pending', assignment_mode = 'manual',
             updated_at = datetime('now')
       WHERE id = ?
    `).run(painter.id, req.params.id);

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    try {
      const parties = notifyParties(updated);
      notifications.emit('booking.assigned', { booking: updated, ...parties });
    } catch (_) {}
    try {
      audit.record({
        action: 'booking.assigned_manual', entityType: 'booking', entityId: req.params.id,
        actorId: req.user.id, actorRole: req.user.role,
        payload: JSON.stringify({ painter_id: painter.id, from_status: booking.status }),
      });
    } catch (_) {}

    res.json({
      success: true,
      message: `Booking ${req.params.id} assigned to ${painter.painter_name}. They have 2 hours to confirm.`,
      booking: enrichBooking(updated),
    });
  })
);

// PUT /api/bookings/:id/approve-assignment
//
// Dispatcher approves an auto-proposed painter. The booking must be
// 'pending_approval'. We re-check the painter is still eligible + available
// (the proposal may be minutes or hours old), then advance to 'pending' and
// notify the painter (their 2-hour confirm window starts now).
router.put('/:id/approve-assignment', protect, restrictTo('admin'),
  requireSubRole('dispatcher'),
  asyncHandler(async (req, res) => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) throw notFound('Booking not found.');
    if (booking.status !== 'pending_approval') {
      throw badRequest(`Booking ${req.params.id} is ${booking.status} — only proposed (pending_approval) bookings can be approved.`);
    }
    if (booking.painter_id == null) {
      throw badRequest(`Booking ${req.params.id} has no proposed painter to approve.`);
    }

    const painter = db.prepare(`
      SELECT pp.id, pp.suspended_at, u.name AS painter_name
        FROM painter_profiles pp JOIN users u ON u.id = pp.user_id
       WHERE pp.id = ?
    `).get(booking.painter_id);
    if (!painter) throw notFound('Proposed painter no longer exists.');
    if (painter.suspended_at) {
      throw conflict(`${painter.painter_name} has been suspended since being proposed. Reject and reassign.`);
    }
    const avail = availability.isPainterAvailable({
      painterId: painter.id, startDate: booking.job_date, durationDays: booking.duration_days,
      excludeBookingId: booking.id,   // don't let the proposal conflict with itself
    });
    if (!avail.available) {
      throw conflict(
        `${painter.painter_name} is no longer available for ${booking.job_date}. Reject and reassign.`,
        { conflicts: avail.conflicts }
      );
    }

    db.prepare(`UPDATE bookings SET status = 'pending', updated_at = datetime('now') WHERE id = ?`)
      .run(req.params.id);

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    try {
      const parties = notifyParties(updated);
      notifications.emit('booking.assigned', { booking: updated, ...parties });
    } catch (_) {}
    try {
      audit.record({
        action: 'booking.assignment_approved', entityType: 'booking', entityId: req.params.id,
        actorId: req.user.id, actorRole: req.user.role,
        payload: JSON.stringify({ painter_id: painter.id }),
      });
    } catch (_) {}

    res.json({
      success: true,
      message: `Approved. ${painter.painter_name} has been notified and has 2 hours to confirm.`,
      booking: enrichBooking(updated),
    });
  })
);

// PUT /api/bookings/:id/reject-assignment
//
// Dispatcher rejects an auto-proposed painter. The rejected painter is recorded
// so they're never re-proposed for this booking, the booking drops back to
// 'pending_assignment', and we immediately try to propose the next-best painter.
// The response says whether a replacement was found or it's back in the manual
// queue. The painter is never notified (they were only ever a proposal).
router.put('/:id/reject-assignment', protect, restrictTo('admin'),
  requireSubRole('dispatcher'),
  asyncHandler(async (req, res) => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) throw notFound('Booking not found.');
    if (booking.status !== 'pending_approval') {
      throw badRequest(`Booking ${req.params.id} is ${booking.status} — only proposed (pending_approval) bookings can be rejected.`);
    }

    const rejectedId = booking.painter_id;
    let rejected = [];
    try { rejected = JSON.parse(booking.rejected_painter_ids || '[]'); } catch (_) { rejected = []; }
    if (rejectedId != null && !rejected.includes(rejectedId)) rejected.push(rejectedId);
    // Bound the list so it can't grow without limit (defensive — in practice
    // it's capped by the roster size). Keep the most recent rejections; a
    // painter rejected long ago could become eligible again, which is fine.
    const REJECTED_CAP = 25;
    if (rejected.length > REJECTED_CAP) rejected = rejected.slice(-REJECTED_CAP);

    db.prepare(`
      UPDATE bookings
         SET painter_id = NULL, status = 'pending_assignment', assignment_mode = NULL,
             rejected_painter_ids = ?, updated_at = datetime('now')
       WHERE id = ?
    `).run(JSON.stringify(rejected), req.params.id);

    try {
      audit.record({
        action: 'booking.assignment_rejected', entityType: 'booking', entityId: req.params.id,
        actorId: req.user.id, actorRole: req.user.role,
        payload: JSON.stringify({ rejected_painter_id: rejectedId, reason: (req.body && req.body.reason) || null }),
      });
    } catch (_) {}

    // Immediately propose the next-best painter (excludes everyone rejected).
    let next = { assigned: false };
    try { next = autoAssign.autoAssignBooking(req.params.id, { actorId: req.user.id }); } catch (_) {}

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    res.json({
      success: true,
      reproposed: next.assigned === true,
      message: next.assigned
        ? `Rejected. A different Paint Master has been proposed — review it above.`
        : `Rejected. No other Paint Master is free right now; the booking is back in the manual queue.`,
      booking: enrichBooking(updated),
    });
  })
);

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
  try {
    const fresh = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    notifications.emit('booking.confirmed', { booking: fresh, ...notifyParties(fresh) });
  } catch (_) {}
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
  // Return any committed paint stock to the pool. Safe to call even when
  // there are no reservations — releaseReservations is idempotent.
  let released = 0;
  if (booking.quote_id) {
    try {
      released = paintVolume.releaseReservations({
        quote_id: booking.quote_id,
        reason:   `Booking ${req.params.id} cancelled`,
      }).released;
    } catch (e) {
      // Non-fatal — cancellation already persisted. Log so dev sees it.
      console.warn('releaseReservations failed:', e.message);
    }
  }
  try {
    notifications.emit('booking.cancelled', {
      booking,
      ...notifyParties(booking),
      refund,
    });
  } catch (_) {}
  // The actual refund execution is handled by services/refunds.issue() — invoke when payments are wired.

  res.json({
    success: true,
    message: refund.eligible === 'full'
      ? `Booking cancelled. Full refund of GH₵${refund.amount} will be processed.`
      : `Booking cancelled. Partial refund of GH₵${refund.amount} (${refund.fee} cancellation fee).`,
    booking_id: req.params.id,
    status: 'cancelled',
    refund,
    paint_reservations_released: released,
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
  // Painter marks the job done — now it sits in qa_pending waiting for a QA
  // sign-off. Reservations don't get consumed and payouts don't release
  // until PUT /:id/qa-approve fires.
  db.prepare(`UPDATE bookings SET status = 'qa_pending', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  try {
    const fresh = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    notifications.emit('painter.done', { booking: fresh, ...notifyParties(fresh) });
  } catch (_) {}
  res.json({
    success: true,
    message: `Job marked done. QA will inspect before final payout — usually within 48 hours.`,
    booking_id: req.params.id, status: 'qa_pending',
  });
}));

// PUT /api/bookings/:id/qa-approve
//
// QA signs off on a finished job. Three effects in one transaction:
//   1. Booking flips qa_pending → completed (the customer-visible terminal
//      state, where the 12-month warranty kicks in).
//   2. Any paint_reservations on the linked quote get marked 'consumed' —
//      the inventory ledger now reflects paint actually used on a wall.
//   3. The response surfaces the painter's payout (released by finance).
//
// Allowed sub-roles: qa (and super_admin via the requireSubRole bypass).
router.put('/:id/qa-approve', protect, restrictTo('admin'),
  requireSubRole('qa'),
  asyncHandler(async (req, res) => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) throw notFound('Booking not found.');
    if (booking.status !== 'qa_pending') {
      throw badRequest(`Booking is ${booking.status}, not qa_pending. Only qa_pending bookings can be approved.`);
    }

    let consumed = 0;
    db.transaction(() => {
      db.prepare(`UPDATE bookings SET status = 'completed', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
      if (booking.quote_id) {
        consumed = paintVolume.consumeReservations({ quote_id: booking.quote_id }).consumed;
      }
    })();

    // Painter payout is the operator-set payout % (default 90%) of the LABOUR
    // base only — never materials, never the platform fee (see
    // docs/business-logic.md). Migration 030 added a `labour` column; for
    // pre-migration rows we derive it from platform_fee, which has always been
    // computed on the labour base alone. The payout % comes from the rate card
    // so changing it in admin/pricing.html actually moves what painters are paid.
    let labour = booking.labour;
    if (labour == null) {
      if (booking.platform_fee && C.PLATFORM_FEE_PCT > 0) {
        labour = +(booking.platform_fee / C.PLATFORM_FEE_PCT).toFixed(2);
      } else {
        labour = booking.subtotal || booking.total || 0;   // last-resort fallback
      }
    }
    const payoutPct = require('../services/rateCard').getRateCard().painterPayoutPct;
    const payout = +(labour * payoutPct).toFixed(2);
    try {
      const fresh = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
      notifications.emit('qa.approved', {
        booking: fresh,
        ...notifyParties(fresh),
        payout,
      });
    } catch (_) {}
    res.json({
      success: true,
      message: `QA approved. Booking completed. Painter payout of GH₵${payout.toFixed(2)} released.`,
      booking_id: req.params.id, status: 'completed',
      paint_reservations_consumed: consumed,
    });
  })
);

// PUT /api/bookings/:id/qa-reject
//
// QA found issues with the finished job — booking goes back to in_progress
// for the painter to fix. Reservations stay 'reserved' (the paint is still
// in the customer's commitment pool until the rework happens).
router.put('/:id/qa-reject', protect, restrictTo('admin'),
  requireSubRole('qa'),
  [ body('reason').optional().isString().isLength({ max: 1000 }) ], validate,
  asyncHandler(async (req, res) => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) throw notFound('Booking not found.');
    if (booking.status !== 'qa_pending') {
      throw badRequest(`Booking is ${booking.status}, not qa_pending.`);
    }
    const reason = (req.body && req.body.reason && String(req.body.reason).trim()) || null;
    // Stash the rejection reason on the notes column so the painter can see
    // what needs fixing. We append rather than overwrite to keep history.
    const newNotes = reason
      ? `${booking.notes ? booking.notes + '\n\n' : ''}[QA rework requested ${new Date().toISOString().slice(0,10)}]: ${reason}`
      : booking.notes;
    db.prepare(`
      UPDATE bookings
         SET status = 'in_progress', notes = ?, updated_at = datetime('now')
       WHERE id = ?
    `).run(newNotes, req.params.id);
    try {
      const fresh = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
      notifications.emit('qa.rejected', {
        booking: fresh,
        ...notifyParties(fresh),
        reason,
      });
    } catch (_) {}

    res.json({
      success: true,
      message: `QA flagged issues. Booking sent back to in_progress for rework.`,
      booking_id: req.params.id, status: 'in_progress',
      reason,
    });
  })
);

module.exports = router;
