// ============================
// services/refunds.js — issue refunds via the payment gateway and persist.
// STATUS: SKELETON. The DB write is real; the Paystack call is stubbed.
// ============================

const db        = require('../db');
const log       = require('../utils/logger');
const payments  = require('./payments');
const { calculateRefund } = require('./pricing');
const { notFound, badRequest } = require('../utils/errors');

async function issue({ bookingId, reason, actorId, now = new Date() }) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) throw notFound(`Booking ${bookingId} not found`);

  const payment = db.prepare(`SELECT * FROM payments WHERE booking_id = ? AND status = 'success' ORDER BY paid_at DESC LIMIT 1`).get(bookingId);
  if (!payment) throw badRequest('No successful payment to refund.');

  const calc = calculateRefund({ total: payment.amount, jobDateIso: booking.job_date, now });

  // Persist a pending refund row first — gateway call comes next.
  const insert = db.prepare(`
    INSERT INTO refunds (payment_id, booking_id, amount, reason, status, created_by)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `);
  const r = insert.run(payment.id, bookingId, calc.amount, reason || null, actorId || null);

  // TODO: call payments.refund(payment.gateway_ref, calc.amount) and update status.
  log.info({ refundId: r.lastInsertRowid, amount: calc.amount }, 'Refund recorded (gateway call pending implementation)');
  void payments;

  return { id: r.lastInsertRowid, ...calc, status: 'pending' };
}

module.exports = { issue };
