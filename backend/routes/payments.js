// ============================
// routes/payments.js — Phase 1 Hubtel inbound rail.
//
// Endpoints (mounted at /api/payments from server.js):
//   POST /charge              customer-auth, idempotent — initiate MoMo charge
//   POST /callback            no-auth, signature-verified — Hubtel webhook
//   GET  /:reference          owner or admin — payment + escrow status
//
// The booking math implements the two locked decisions from PAYMENTS.md:
//   * 7-day holdback: escrow_holds.holdback_until = qa_passed_at + 7 days.
//   * 5% visible warranty reserve: warranty_pesewas = 0.05 × net_pesewas.
//
// Notes on the wire format
//   * Money sent to clients stays in GHS decimals to match the existing
//     payments.amount column. Internally we move to integer pesewas through
//     utils/money.toPesewas — float math on currency is forbidden in any
//     ledger calculation.
//   * The /callback route uses express.raw() so the HMAC signature can be
//     verified against the exact bytes Hubtel sent. We then JSON.parse() the
//     buffer ourselves inside services.payments.parseCallback.
// ============================

const express = require('express');
const { body, param } = require('express-validator');

const db          = require('../db');
const log         = require('../utils/logger');
const validate    = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const idempotency = require('../middleware/idempotency');
const { protect } = require('../middleware/auth');
const payments    = require('../services/payments');
const { toPesewas, toCedis } = require('../utils/money');
const { notFound, badRequest, forbidden, conflict } = require('../utils/errors');

const router = express.Router();

// ----- helpers -------------------------------------------------------------

/**
 * Compute the four-way pesewa split for a booking, per the locked decisions:
 *   gross         = booking.total
 *   platform_fee  = booking.platform_fee   (already 10% of subtotal)
 *   net           = gross - platform_fee
 *   warranty hold = 5% of net              (parked in warranty_ledger)
 *   payable       = net - warranty hold    (released to painter after holdback)
 */
function computeSplit(booking) {
  const gross_pesewas        = toPesewas(booking.total);
  const platform_fee_pesewas = toPesewas(booking.platform_fee);
  const net_pesewas          = gross_pesewas - platform_fee_pesewas;
  const warranty_reserve_pesewas = Math.round(net_pesewas * 0.05);
  const payable_pesewas      = net_pesewas - warranty_reserve_pesewas;
  return { gross_pesewas, platform_fee_pesewas, net_pesewas, warranty_reserve_pesewas, payable_pesewas };
}

function loadOwnedBooking(req) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.body.booking_id || req.params.bookingId);
  if (!booking) throw notFound('Booking not found.');
  if (req.user.role !== 'admin' && booking.customer_id !== req.user.id) {
    throw forbidden('This booking is not yours.');
  }
  return booking;
}

// ----- POST /charge --------------------------------------------------------
// Customer initiates a MoMo charge for a confirmed (or pending) booking.

router.post('/charge',
  protect,
  idempotency('payments.charge'),
  [
    body('booking_id').isString().notEmpty(),
    body('msisdn').isString().notEmpty(),
    body('channel').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const booking = loadOwnedBooking(req);
    if (booking.payment_status === 'paid') {
      throw conflict('This booking is already paid.');
    }

    // Initiate the MoMo prompt against Hubtel.
    const charge = await payments.initiateCharge({
      msisdn:    req.body.msisdn,
      amountGHS: booking.total,
      bookingId: booking.id,
      channel:   req.body.channel || 'mtn',
    });

    // Record the payment row up-front so the callback has something to update.
    // Status starts 'pending'; the callback flips it to 'success' or 'failed'.
    db.prepare(`
      INSERT INTO payments (reference, gateway_ref, booking_id, customer_id, amount, currency, channel, status, raw_response, provider)
      VALUES (?, ?, ?, ?, ?, 'GHS', ?, 'pending', ?, 'hubtel')
    `).run(
      charge.reference,
      charge.transaction_id,
      booking.id,
      booking.customer_id,
      booking.total,
      req.body.channel || 'mtn',
      JSON.stringify(charge.raw || { stub: !!charge.stub }),
    );

    res.status(202).json({
      success: true,
      message: 'MoMo prompt sent. Customer should approve on their phone.',
      reference:      charge.reference,
      transaction_id: charge.transaction_id,
      status:         charge.status,
      stub:           !!charge.stub,
    });
  })
);

// ----- POST /callback ------------------------------------------------------
// Hubtel pushes the final transaction status here. No auth — instead we
// verify the HMAC signature and use the gateway's transaction ID as our
// idempotency key.

router.post('/callback',
  // No route-level body parser. server.js's express.json captures the raw
  // bytes onto req.rawBody via a verify hook; we use that for HMAC and the
  // already-parsed req.body for everything else.
  // Idempotency keyed by Hubtel's transaction id (extracted from the body),
  // not the Idempotency-Key header — Hubtel doesn't send one.
  idempotency('payments.callback', {
    required: false,
    keyFrom: (req) => {
      const b = req.body;
      if (!b || typeof b !== 'object') return undefined;
      return b?.Data?.TransactionId || b?.TransactionId || b?.Data?.ClientReference || b?.ClientReference;
    },
  }),
  asyncHandler(async (req, res) => {
    const sig    = req.headers['x-hubtel-signature'] || req.headers['x-signature'];
    const rawBuf = req.rawBody || Buffer.from(JSON.stringify(req.body || {}), 'utf8');
    const parsed = payments.parseCallback(rawBuf, sig);

    // Persist the raw event first — even if the rest of this fails we have it.
    const payment = db.prepare('SELECT * FROM payments WHERE reference = ?').get(parsed.reference);
    db.prepare(`
      INSERT INTO payment_events (payment_id, event_type, body, signature)
      VALUES (?, ?, ?, ?)
    `).run(
      payment ? payment.id : null,
      `hubtel.${parsed.status}`,
      rawBuf.toString('utf8'),
      sig ? String(sig).slice(0, 200) : null,
    );

    if (!payment) {
      // Callback for an unknown reference — persist the event (above) and
      // 200 it so Hubtel doesn't retry forever; investigate via reconciliation.
      log.warn({ reference: parsed.reference }, 'callback for unknown payment reference');
      return res.json({ success: true, status: 'orphaned' });
    }

    if (payment.status === 'success') {
      // Already processed (callback re-delivery race that beat the idempotency
      // cache). Acknowledge and exit.
      return res.json({ success: true, status: 'already_processed' });
    }

    if (parsed.status !== 'success') {
      db.prepare(`
        UPDATE payments
           SET status = ?, gateway_ref = COALESCE(gateway_ref, ?), raw_response = ?
         WHERE id = ?
      `).run(parsed.status, parsed.gateway_ref, JSON.stringify(parsed.raw), payment.id);
      return res.json({ success: true, status: parsed.status });
    }

    // Success path — flip payment, flip booking, create escrow_holds + warranty_ledger.
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(payment.booking_id);
    if (!booking) {
      log.error({ booking_id: payment.booking_id }, 'callback success for missing booking');
      return res.json({ success: true, status: 'orphaned_booking' });
    }
    const split = computeSplit(booking);

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE payments
           SET status = 'success',
               gateway_ref = COALESCE(gateway_ref, ?),
               raw_response = ?,
               paid_at = datetime('now')
         WHERE id = ?
      `).run(parsed.gateway_ref, JSON.stringify(parsed.raw), payment.id);

      db.prepare(`UPDATE bookings SET payment_status = 'paid', updated_at = datetime('now') WHERE id = ?`)
        .run(booking.id);

      // Create the escrow_hold. holdback_until is null until QA passes; the
      // QA-pass route (Phase 2) sets qa_passed_at + holdback_until = +7d.
      const insert = db.prepare(`
        INSERT INTO escrow_holds
          (booking_id, payment_id,
           gross_pesewas, platform_fee_pesewas, net_pesewas, warranty_reserve_pesewas, payable_pesewas,
           status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'held')
      `).run(
        booking.id, payment.id,
        split.gross_pesewas, split.platform_fee_pesewas, split.net_pesewas,
        split.warranty_reserve_pesewas, split.payable_pesewas,
      );

      // Mirror the warranty slice into the per-painter ledger (visible to painters).
      // release_at is null until job_completed_at is set; the job-complete route
      // will fill it in as completed_at + 90 days.
      db.prepare(`
        INSERT INTO warranty_ledger
          (painter_id, booking_id, escrow_hold_id, warranty_pesewas, status)
        VALUES (?, ?, ?, ?, 'reserved')
      `).run(booking.painter_id, booking.id, insert.lastInsertRowid, split.warranty_reserve_pesewas);
    });
    tx();

    res.json({
      success: true,
      status: 'success',
      reference: parsed.reference,
      booking_id: booking.id,
      escrow: {
        gross_GHS:            toCedis(split.gross_pesewas),
        platform_fee_GHS:     toCedis(split.platform_fee_pesewas),
        net_GHS:              toCedis(split.net_pesewas),
        warranty_reserve_GHS: toCedis(split.warranty_reserve_pesewas),
        payable_GHS:          toCedis(split.payable_pesewas),
      },
    });
  })
);

// ----- GET /:reference -----------------------------------------------------
// Owner or admin can poll the current state. Useful for the post-charge
// "waiting for MoMo prompt" UI.

router.get('/:reference',
  protect,
  [param('reference').isString().notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const payment = db.prepare('SELECT * FROM payments WHERE reference = ?').get(req.params.reference);
    if (!payment) throw notFound('Payment not found.');
    if (req.user.role !== 'admin' && payment.customer_id !== req.user.id) {
      throw forbidden('This payment is not yours.');
    }
    const escrow = db.prepare('SELECT * FROM escrow_holds WHERE payment_id = ?').get(payment.id) || null;
    res.json({
      success: true,
      payment: {
        reference:   payment.reference,
        gateway_ref: payment.gateway_ref,
        booking_id:  payment.booking_id,
        amount_GHS:  payment.amount,
        currency:    payment.currency,
        channel:     payment.channel,
        status:      payment.status,
        provider:    payment.provider,
        paid_at:     payment.paid_at,
        created_at:  payment.created_at,
      },
      escrow: escrow ? {
        status:                escrow.status,
        gross_GHS:             toCedis(escrow.gross_pesewas),
        platform_fee_GHS:      toCedis(escrow.platform_fee_pesewas),
        net_GHS:               toCedis(escrow.net_pesewas),
        warranty_reserve_GHS:  toCedis(escrow.warranty_reserve_pesewas),
        payable_GHS:           toCedis(escrow.payable_pesewas),
        qa_passed_at:          escrow.qa_passed_at,
        holdback_until:        escrow.holdback_until,
        released_at:           escrow.released_at,
      } : null,
    });
  })
);

module.exports = router;
