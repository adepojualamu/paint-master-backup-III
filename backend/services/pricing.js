// ============================
// services/pricing.js — CANONICAL quote calculator.
//
// This is the single source of truth for "what does a job cost?" Both the
// frontend quote page and the backend booking-create route MUST go through
// this module so the quote a customer sees and the price they're charged
// can never disagree.
//
// Inputs and outputs are pure JS objects — no DB, no req/res. That makes it
// trivially testable.
// ============================

const C = require('../config/constants');
const { badRequest } = require('../utils/errors');

/**
 * Calculate a quote.
 *
 * @param {object} input
 * @param {string} input.service          One of C.RATE_PER_SQM keys.
 * @param {number} input.area_sqm         Total square metres of the job.
 * @param {number} input.duration_days    Painter days needed.
 * @param {number} input.rate_per_day     The painter's day-rate (GHS).
 * @param {boolean} [input.materials_included]  Customer wants painter to supply paint.
 * @returns {object} breakdown + totals
 */
function calculateQuote(input) {
  const service       = String(input.service || '');
  const area          = Number(input.area_sqm);
  const days          = Number(input.duration_days);
  const ratePerDay    = Number(input.rate_per_day);
  const includeMats   = !!input.materials_included;

  // ----- validation -----
  if (!C.RATE_PER_SQM[service]) {
    throw badRequest(`Unknown service: ${service}`, { allowed: Object.keys(C.RATE_PER_SQM) });
  }
  if (!Number.isFinite(area)  || area  < C.MIN_AREA_SQM || area  > C.MAX_AREA_SQM)
    throw badRequest(`area_sqm must be between ${C.MIN_AREA_SQM} and ${C.MAX_AREA_SQM}`);
  if (!Number.isInteger(days) || days  < C.MIN_DURATION_DAYS || days > C.MAX_DURATION_DAYS)
    throw badRequest(`duration_days must be between ${C.MIN_DURATION_DAYS} and ${C.MAX_DURATION_DAYS}`);
  if (!Number.isFinite(ratePerDay) || ratePerDay < C.MIN_RATE_PER_DAY || ratePerDay > C.MAX_RATE_PER_DAY)
    throw badRequest(`rate_per_day must be between ${C.MIN_RATE_PER_DAY} and ${C.MAX_RATE_PER_DAY}`);

  // ----- components -----
  const labour    = round2(ratePerDay * days);
  const sqmCharge = round2(area * C.RATE_PER_SQM[service]);
  const materials = includeMats ? round2(area * C.MATERIALS_PER_SQM) : 0;

  // The painter is paid for time AND complexity (sqm-based service component).
  // Materials are pass-through; we don't take fee on them.
  const subtotal     = round2(labour + sqmCharge + materials);
  const feeBase      = round2(labour + sqmCharge);
  const platform_fee = round2(feeBase * C.PLATFORM_FEE_PCT);
  const total        = round2(subtotal + platform_fee);

  return {
    inputs: { service, area_sqm: area, duration_days: days, rate_per_day: ratePerDay, materials_included: includeMats },
    breakdown: {
      labour,
      service_charge: sqmCharge,
      materials,
      subtotal,
      platform_fee,
      total,
    },
    // Convenience top-level fields the route can store directly on bookings.
    subtotal,
    platform_fee,
    total,
    painter_payout: round2(total * C.PAINTER_PAYOUT_PCT),
  };
}

/**
 * Refund calculation given a booking and the moment of cancellation.
 *
 * @param {object} args
 * @param {number} args.total            Total amount the customer paid.
 * @param {string} args.jobDateIso       ISO date the job was scheduled for.
 * @param {Date}   [args.now]            Defaults to now; injectable for tests.
 */
function calculateRefund({ total, jobDateIso, now = new Date() }) {
  const hoursUntil = (new Date(jobDateIso) - now) / 36e5;
  if (hoursUntil >= C.REFUND_FULL_HOURS) {
    return { eligible: 'full', amount: round2(total), fee: 0, hoursUntil };
  }
  const fee    = round2(total * C.REFUND_LATE_FEE_PCT);
  const refund = round2(total - fee);
  return { eligible: 'partial', amount: refund, fee, hoursUntil };
}

function round2(n) { return Math.round(n * 100) / 100; }

module.exports = { calculateQuote, calculateRefund };
