// ============================
// services/pricing.js — CANONICAL quote calculator.
//
// This is the single source of truth for "what does a job cost?" Both the
// frontend quote page and the backend booking-create route MUST go through
// this module so the quote a customer sees and the price they're charged
// can never disagree.
//
// The rates themselves are operator-owned: they come from the editable rate
// card (services/rateCard.js → pricing_settings table), NOT from hardcoded
// constants. calculateQuote takes an optional `rates` argument so it stays a
// pure, trivially-testable function (pass a rate card in); when omitted it
// lazily loads the live rate card. Validation bounds (area/days) remain in
// config/constants.js.
// ============================

const C = require('../config/constants');
const { badRequest } = require('../utils/errors');

/**
 * Calculate a quote.
 *
 * @param {object} input
 * @param {string} input.service          One of the rate card's service keys.
 * @param {number} input.area_sqm         Total square metres of the job.
 * @param {number} input.duration_days    Painter days needed.
 * @param {number} input.rate_per_day     The painter's day-rate (GHS).
 * @param {boolean} [input.materials_included]  Customer wants painter to supply paint.
 * @param {object} [rates]                The rate card (see services/rateCard.getRateCard()).
 *                                        Defaults to the live rate card when omitted.
 * @returns {object} breakdown + totals
 */
function calculateQuote(input, rates) {
  // Lazy-load the live rate card if the caller didn't inject one. Lazy require
  // avoids a load-time circular dependency (rateCard → db → ...).
  if (!rates) rates = require('./rateCard').getRateCard();

  const service       = String(input.service || '');
  const area          = Number(input.area_sqm);
  const days          = Number(input.duration_days);
  const ratePerDay    = Number(input.rate_per_day);
  // Materials are always included now. The platform supplies paint + primer on
  // every job (pricing reconciliation), so materials are no longer optional —
  // the input flag is retained only so the stored record echoes it as true.
  const includeMats   = true;

  const ratePerSqm = rates.ratePerSqm || {};

  // ----- validation -----
  if (!(service in ratePerSqm)) {
    throw badRequest(`Unknown service: ${service}`, { allowed: Object.keys(ratePerSqm) });
  }
  if (!Number.isFinite(area)  || area  < C.MIN_AREA_SQM || area  > C.MAX_AREA_SQM)
    throw badRequest(`area_sqm must be between ${C.MIN_AREA_SQM} and ${C.MAX_AREA_SQM}`);
  if (!Number.isInteger(days) || days  < C.MIN_DURATION_DAYS || days > C.MAX_DURATION_DAYS)
    throw badRequest(`duration_days must be between ${C.MIN_DURATION_DAYS} and ${C.MAX_DURATION_DAYS}`);
  if (!Number.isFinite(ratePerDay) || ratePerDay < C.MIN_RATE_PER_DAY || ratePerDay > C.MAX_RATE_PER_DAY)
    throw badRequest(`rate_per_day must be between ${C.MIN_RATE_PER_DAY} and ${C.MAX_RATE_PER_DAY}`);

  // ----- components -----
  // The painter is compensated for two things — their time (day-rate × days)
  // and the complexity of the surface (per-sqm × area). Both go into the
  // painter's `labour` total, which is the base both the platform fee and
  // the painter's payout are calculated against. Materials are pass-through:
  // the customer reimburses the platform's paint cost and the platform pays
  // the supplier. The platform takes no margin on materials and the painter
  // sees none of that money. VAT is applied last, on the pre-tax total. See
  // docs/business-logic.md.
  const labour_day = round2(ratePerDay * days);
  const labour_sqm = round2(area * ratePerSqm[service]);
  const labour     = round2(labour_day + labour_sqm);
  const materials  = includeMats ? round2(area * rates.materialsPerSqm) : 0;

  const subtotal     = round2(labour + materials);                 // labour + pass-through materials
  const platform_fee = round2(labour * rates.platformFeePct);      // fee is on labour only
  const total_ex_vat = round2(subtotal + platform_fee);            // pre-tax total
  const vat          = round2(total_ex_vat * rates.vatPct);        // Ghana VAT on the pre-tax total
  const total        = round2(total_ex_vat + vat);                 // VAT-inclusive amount the customer pays

  return {
    inputs: { service, area_sqm: area, duration_days: days, rate_per_day: ratePerDay, materials_included: includeMats },
    breakdown: {
      labour,                       // painter's compensation base
      labour_day,                   // breakdown: time component
      labour_sqm,                   // breakdown: surface-complexity component
      materials,                    // pass-through, platform-supplied
      subtotal,
      platform_fee,                 // = labour × platformFeePct
      total_ex_vat,                 // subtotal + platform_fee
      vat,                          // = total_ex_vat × vatPct
      total,                        // VAT-inclusive
    },
    // Convenience top-level fields the route can store directly on bookings.
    labour,
    subtotal,
    platform_fee,
    total_ex_vat,
    vat,
    total,
    // Forward-looking hint of the painter's payout. The authoritative payout
    // happens in routes/bookings.js qa-approve and uses the persisted
    // `labour` column from the booking row (not this hint).
    painter_payout: round2(labour * rates.painterPayoutPct),
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
