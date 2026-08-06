// ============================
// routes/finance.js — endpoints owned by the finance sub-role.
//
// What "finance" needs that other sub-roles don't:
//   - A queue of completed bookings whose painter hasn't been paid yet
//     (mark-paid flips painter_paid_at).
//   - A queue of cancelled bookings whose refund hasn't been issued yet
//     (mark-refunded flips refund_processed_at + writes a refunds row).
//   - A bird's-eye summary: revenue, platform fees collected, outstanding
//     payouts, outstanding refunds.
//
// All endpoints are gated to admin + the 'finance' sub-role (super_admin
// passes via the requireSubRole bypass).
// ============================

const express  = require('express');
const { param, body } = require('express-validator');

const db           = require('../db');
const C            = require('../config/constants');
const validate     = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { protect, restrictTo, requireSubRole } = require('../middleware/auth');
const { calculateRefund } = require('../services/pricing');
const { notFound, badRequest } = require('../utils/errors');

const router = express.Router();

router.use(protect, restrictTo('admin'), requireSubRole('finance'));

// Helper — pull customer + painter display names in one go so the
// dashboard doesn't have to fan out to /api/users for every row.
function enrichRow(b) {
  if (!b) return b;
  const customer = b.customer_id
    ? db.prepare('SELECT name, phone, email FROM users WHERE id = ?').get(b.customer_id)
    : null;
  const painter  = b.painter_id
    ? db.prepare(`
        SELECT u.name, u.phone FROM painter_profiles pp
          JOIN users u ON u.id = pp.user_id WHERE pp.id = ?
      `).get(b.painter_id)
    : null;
  return {
    ...b,
    customer_name:  customer?.name  || null,
    customer_phone: customer?.phone || null,
    customer_email: customer?.email || null,
    painter_name:   painter?.name   || null,
    painter_phone:  painter?.phone  || null,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/finance/payouts
//
// Painter payout queue. By default returns completed bookings whose
// painter_paid_at is still NULL. `?status=paid` returns the historical
// roll. Each row carries the computed payout (total × PAINTER_PAYOUT_PCT)
// and platform fee.
// ─────────────────────────────────────────────────────────────
router.get('/payouts',
  asyncHandler(async (req, res) => {
    const status = req.query.status === 'paid' ? 'paid' : 'pending';
    const limit  = Math.min(C.MAX_PAGE_SIZE, parseInt(req.query.limit || '50', 10));
    const sql = status === 'pending'
      ? `SELECT * FROM bookings WHERE status='completed' AND painter_paid_at IS NULL
           ORDER BY updated_at ASC LIMIT ?`
      : `SELECT * FROM bookings WHERE status='completed' AND painter_paid_at IS NOT NULL
           ORDER BY painter_paid_at DESC LIMIT ?`;
    const rows = db.prepare(sql).all(limit);
    const items = rows.map(b => {
      const e = enrichRow(b);
      const payout = +(b.total * C.PAINTER_PAYOUT_PCT).toFixed(2);
      return { ...e, computed_payout: payout };
    });
    res.json({ success: true, status, count: items.length, items });
  })
);

// ─────────────────────────────────────────────────────────────
// PUT /api/finance/bookings/:id/mark-paid
//
// Finance records that the painter payout has been issued (MoMo transfer
// done, or whatever channel finance used). Idempotent — calling twice on
// an already-paid booking just returns the stamped row.
// ─────────────────────────────────────────────────────────────
router.put('/bookings/:id/mark-paid', [
  param('id').isString().notEmpty(),
  body('note').optional().isString().isLength({ max: 500 }),
], validate, asyncHandler(async (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) throw notFound('Booking not found.');
  if (booking.status !== 'completed') {
    throw badRequest(`Booking is ${booking.status}. Only completed bookings can have a painter payout marked.`);
  }
  if (booking.painter_paid_at) {
    return res.json({
      success: true,
      message: `Already marked paid at ${booking.painter_paid_at}.`,
      booking: enrichRow(booking),
    });
  }
  db.prepare(`
    UPDATE bookings
       SET painter_paid_at = datetime('now'),
           painter_paid_by = ?,
           updated_at      = datetime('now')
     WHERE id = ?
  `).run(req.user.id, req.params.id);
  const fresh = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  res.json({
    success: true,
    message: `Painter payout for ${req.params.id} marked paid.`,
    booking: enrichRow(fresh),
  });
}));

// ─────────────────────────────────────────────────────────────
// GET /api/finance/refunds
//
// Cancelled bookings with a refund still owing. Each row carries the
// computed refund amount (calculateRefund honours the 48-hour rule).
// ?status=processed for the historical view.
// ─────────────────────────────────────────────────────────────
router.get('/refunds',
  asyncHandler(async (req, res) => {
    const status = req.query.status === 'processed' ? 'processed' : 'pending';
    const limit  = Math.min(C.MAX_PAGE_SIZE, parseInt(req.query.limit || '50', 10));
    const sql = status === 'pending'
      ? `SELECT * FROM bookings WHERE status='cancelled' AND refund_processed_at IS NULL
           ORDER BY updated_at ASC LIMIT ?`
      : `SELECT * FROM bookings WHERE status='cancelled' AND refund_processed_at IS NOT NULL
           ORDER BY refund_processed_at DESC LIMIT ?`;
    const rows = db.prepare(sql).all(limit);
    const items = rows.map(b => {
      const e = enrichRow(b);
      const refund = calculateRefund({ total: b.total, jobDateIso: b.job_date });
      return { ...e, computed_refund: refund };
    });
    res.json({ success: true, status, count: items.length, items });
  })
);

// PUT /api/finance/bookings/:id/mark-refunded
router.put('/bookings/:id/mark-refunded', [
  param('id').isString().notEmpty(),
  body('amount').optional().isFloat({ min: 0 }),
  body('note').optional().isString().isLength({ max: 500 }),
], validate, asyncHandler(async (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) throw notFound('Booking not found.');
  if (booking.status !== 'cancelled') {
    throw badRequest(`Booking is ${booking.status}. Only cancelled bookings can be refunded.`);
  }
  if (booking.refund_processed_at) {
    return res.json({
      success: true,
      message: `Already refunded at ${booking.refund_processed_at}.`,
      booking: enrichRow(booking),
    });
  }
  const refund = calculateRefund({ total: booking.total, jobDateIso: booking.job_date });
  const amount = req.body.amount != null ? Number(req.body.amount) : refund.amount;

  // The refunds table FK-references payments.id and requires payment_id NOT
  // NULL — that's the right shape once a real gateway is wired. Until then,
  // most demo bookings have no payment row, so we only audit-log into
  // refunds when one exists. The booking-side stamp (refund_processed_at +
  // payment_status='refunded') is the source of truth either way.
  db.transaction(() => {
    const payment = db.prepare(
      "SELECT id FROM payments WHERE booking_id = ? AND status = 'success' ORDER BY id DESC LIMIT 1"
    ).get(req.params.id);
    if (payment) {
      db.prepare(`
        INSERT INTO refunds (payment_id, booking_id, amount, reason, status, processed_at, created_by)
        VALUES (?, ?, ?, ?, 'processed', datetime('now'), ?)
      `).run(payment.id, req.params.id, amount, req.body.note || `Refund for cancelled booking ${req.params.id}`, req.user.id);
    }
    db.prepare(`
      UPDATE bookings
         SET refund_processed_at = datetime('now'),
             refund_processed_by = ?,
             payment_status      = 'refunded',
             updated_at          = datetime('now')
       WHERE id = ?
    `).run(req.user.id, req.params.id);
  })();

  const fresh = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  res.json({
    success: true,
    message: `Refund of GH₵${amount.toFixed(2)} marked processed for ${req.params.id}.`,
    booking: enrichRow(fresh),
    amount,
  });
}));

// ─────────────────────────────────────────────────────────────
// GET /api/finance/summary
//
// Bird's-eye numbers for the dashboard top row. All in GHS.
//   - revenue_30d     totals on completed bookings in the last 30 days
//   - platform_fees   our cut (platform_fee column) over the same window
//   - pending_payouts the sum owed to painters on completed-but-unpaid jobs
//   - pending_refunds the sum owed to customers on cancelled-not-yet-refunded
// ─────────────────────────────────────────────────────────────
router.get('/summary',
  asyncHandler(async (req, res) => {
    const revenue = db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS n
        FROM bookings
       WHERE status='completed' AND updated_at >= datetime('now','-30 days')
    `).get();
    const fees = db.prepare(`
      SELECT COALESCE(SUM(platform_fee), 0) AS fees
        FROM bookings
       WHERE status='completed' AND updated_at >= datetime('now','-30 days')
    `).get();
    const pendingPayouts = db.prepare(`
      SELECT COALESCE(SUM(total * ?), 0) AS owed, COUNT(*) AS n
        FROM bookings
       WHERE status='completed' AND painter_paid_at IS NULL
    `).get(C.PAINTER_PAYOUT_PCT);
    const pendingRefunds = db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS gross, COUNT(*) AS n
        FROM bookings
       WHERE status='cancelled' AND refund_processed_at IS NULL
    `).get();

    res.json({
      success: true,
      summary: {
        window_days:      30,
        revenue_30d:      round2(revenue.total),
        completed_count:  revenue.n,
        platform_fees:    round2(fees.fees),
        pending_payouts:  { count: pendingPayouts.n, owed: round2(pendingPayouts.owed) },
        pending_refunds:  { count: pendingRefunds.n, gross: round2(pendingRefunds.gross) },
      },
    });
  })
);

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

module.exports = router;
