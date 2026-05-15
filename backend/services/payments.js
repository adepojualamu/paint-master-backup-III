// ============================
// services/payments.js — Hubtel client (MoMo Receive Money + status + callback).
//
// Replaces the previous Paystack stub. The interface is intentionally narrow
// and rail-agnostic so we can swap in another provider later without touching
// the routes.
//
// STUB MODE
// When HUBTEL_CLIENT_ID is unset (or HUBTEL_MODE=stub), no real HTTP calls
// happen — initiateCharge returns a synthetic 'pending' result with a unique
// reference, verifyCharge returns 'success', and parseCallback accepts any
// payload. This keeps local dev and CI unblocked without real Hubtel keys.
//
// HUBTEL ENDPOINTS WE TALK TO
//   POST /merchantaccount/merchants/{merchantId}/receive/mobilemoney
//        → triggers a USSD prompt to the customer's phone. Customer enters
//          their MoMo PIN; Hubtel calls our callback with the result.
//   GET  /transactions/{transactionId}/status
//        → status lookup, used as belt-and-braces against missed callbacks.
//   POST {our callback URL} ← Hubtel pushes the final status here.
//
// CALLBACK SIGNATURE
// Hubtel signs the callback body with a shared secret you configure in their
// portal (HUBTEL_CALLBACK_SECRET on our side). We verify with HMAC-SHA256
// over the raw request body — see parseCallback below. routes/payments.js
// preserves the raw body via express.raw() before json parsing for this.
// ============================

const crypto = require('crypto');
const config = require('../config');
const log    = require('../utils/logger');
const ids    = require('../utils/ids');
const { toPesewas } = require('../utils/money');
const { badRequest, unprocessable } = require('../utils/errors');

const BASE_URL = 'https://rmp.hubtel.com';
const STATUS_URL = 'https://api.hubtel.com';

function isStubMode() {
  if ((process.env.HUBTEL_MODE || '').toLowerCase() === 'stub') return true;
  return !config.hubtel.clientId || !config.hubtel.clientSecret;
}

function basicAuthHeader() {
  const raw = `${config.hubtel.clientId}:${config.hubtel.clientSecret}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

/**
 * Map a Ghanaian MoMo channel to the string Hubtel expects.
 *   mtn       → mtn-gh
 *   vodafone  → vodafone-gh   (now Telecel — Hubtel still keys it as vodafone-gh)
 *   tigo      → tigo-gh       (AirtelTigo)
 */
function normalizeChannel(channel) {
  const c = String(channel || '').toLowerCase().trim();
  if (['mtn', 'mtn-gh'].includes(c))                       return 'mtn-gh';
  if (['vodafone', 'telecel', 'vodafone-gh'].includes(c))  return 'vodafone-gh';
  if (['tigo', 'airteltigo', 'tigo-gh'].includes(c))       return 'tigo-gh';
  throw badRequest(`Unsupported MoMo channel: ${channel}. Use mtn / telecel / airteltigo.`);
}

/**
 * Trigger a MoMo charge against the customer's phone. They get a USSD prompt;
 * Hubtel callbacks us when they accept or reject it.
 *
 * @param {object} params
 * @param {string} params.msisdn      - customer phone, e.g. '0244000001'
 * @param {number} params.amountGHS   - amount in cedis, decimal
 * @param {string} params.bookingId   - our BK-XXXX reference (passed through as ClientReference)
 * @param {string} params.channel     - 'mtn' | 'telecel' | 'airteltigo'
 * @param {string} [params.callbackUrl] - override; defaults to config-derived URL
 * @returns {Promise<{ reference: string, transaction_id: string|null, status: 'pending'|'success'|'failed', stub?: boolean, raw?: object }>}
 */
async function initiateCharge({ msisdn, amountGHS, bookingId, channel, callbackUrl }) {
  if (!msisdn || !amountGHS || !bookingId) {
    throw badRequest('msisdn, amountGHS, bookingId are required.');
  }
  const amountPesewas = toPesewas(amountGHS);
  if (amountPesewas <= 0) throw badRequest('amountGHS must be > 0.');
  const reference = ids.paymentRef();
  const hubtelChannel = normalizeChannel(channel || 'mtn');

  if (isStubMode()) {
    log.warn({ reference, bookingId }, 'Hubtel STUB MODE — no real charge issued.');
    return {
      reference,
      transaction_id: null,
      status: 'pending',
      stub: true,
    };
  }

  const url = `${BASE_URL}/merchantaccount/merchants/${encodeURIComponent(config.hubtel.merchantAccount)}/receive/mobilemoney`;
  const body = {
    CustomerName:       msisdn,
    CustomerMsisdn:     msisdn,
    Channel:            hubtelChannel,
    Amount:             Number((amountPesewas / 100).toFixed(2)),  // Hubtel wants cedis-as-decimal
    PrimaryCallbackUrl: callbackUrl || config.hubtel.callbackUrl,
    Description:        `Paint Masters booking ${bookingId}`,
    ClientReference:    reference,
  };

  let res;
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: {
        Authorization:  basicAuthHeader(),
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    log.error({ err: err.message, reference }, 'Hubtel network error');
    throw unprocessable('Could not reach payment gateway. Please try again.');
  }

  const raw = await res.json().catch(() => ({}));
  if (!res.ok || raw.ResponseCode !== '0000') {
    log.warn({ status: res.status, raw, reference }, 'Hubtel rejected charge');
    throw unprocessable(raw.Message || `Payment gateway returned ${res.status}.`);
  }

  return {
    reference,
    transaction_id: raw?.Data?.TransactionId || null,
    status: 'pending',
    raw,
  };
}

/**
 * Status lookup for a previously-initiated charge. Used by the polling
 * GET /api/payments/:reference endpoint and by reconciliation.
 */
async function verifyCharge(reference) {
  if (!reference) throw badRequest('reference required.');
  if (isStubMode()) {
    return { reference, status: 'success', amount_pesewas: 0, stub: true };
  }
  const url = `${STATUS_URL}/transactions/${encodeURIComponent(config.hubtel.merchantAccount)}/status?clientReference=${encodeURIComponent(reference)}`;
  const res = await fetch(url, {
    method:  'GET',
    headers: { Authorization: basicAuthHeader(), Accept: 'application/json' },
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw unprocessable(`Status lookup failed (${res.status}).`);
  }
  // Hubtel returns Data.Status = 'Paid' | 'Pending' | 'Failed' | 'Refunded'.
  const s = String(raw?.Data?.Status || '').toLowerCase();
  const status = s === 'paid' ? 'success' : (s === 'failed' ? 'failed' : 'pending');
  const amount_pesewas = Math.round(Number(raw?.Data?.Amount || 0) * 100);
  return { reference, status, amount_pesewas, raw };
}

/**
 * Parse and verify a Hubtel callback payload.
 *
 * Inputs:
 *   rawBody         — Buffer or string — the raw request body BEFORE JSON parsing.
 *   signatureHeader — value of the signature header set by Hubtel (typically
 *                      `x-hubtel-signature`, HMAC-SHA256 hex over the raw body
 *                      with HUBTEL_CALLBACK_SECRET).
 *
 * Returns: { reference, gateway_ref, status, amount_pesewas, channel, raw }
 * Throws: badRequest if signature missing/wrong (in non-stub mode).
 */
function parseCallback(rawBody, signatureHeader) {
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');

  if (!isStubMode()) {
    if (!config.hubtel.callbackSecret) throw badRequest('HUBTEL_CALLBACK_SECRET not configured.');
    if (!signatureHeader)              throw badRequest('Missing callback signature header.');
    const expected = crypto
      .createHmac('sha256', config.hubtel.callbackSecret)
      .update(buf)
      .digest('hex');
    const got = String(signatureHeader).trim().toLowerCase();
    const match = got.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
    if (!match) throw badRequest('Invalid callback signature.');
  }

  let raw;
  try { raw = JSON.parse(buf.toString('utf8') || '{}'); }
  catch { throw badRequest('Callback body is not valid JSON.'); }

  // Hubtel's callback payload shape (Receive Money):
  //   ResponseCode: '0000' for success
  //   Data.ClientReference, Data.TransactionId, Data.Amount, Data.Channel, Data.Status
  const data = raw?.Data || {};
  const reference   = data.ClientReference || raw.ClientReference || null;
  const gateway_ref = data.TransactionId   || raw.TransactionId   || null;
  const sStr        = String(data.Status || raw.Status || '').toLowerCase();
  const status      = (raw.ResponseCode === '0000' || sStr === 'paid') ? 'success'
                    : (sStr === 'failed' ? 'failed' : 'pending');
  const amount_pesewas = Math.round(Number(data.Amount || raw.Amount || 0) * 100);
  const channel     = data.Channel || raw.Channel || null;

  if (!reference) throw badRequest('Callback missing ClientReference.');
  return { reference, gateway_ref, status, amount_pesewas, channel, raw };
}

module.exports = {
  initiateCharge,
  verifyCharge,
  parseCallback,
  // exposed for tests:
  _isStubMode: isStubMode,
  _normalizeChannel: normalizeChannel,
};
