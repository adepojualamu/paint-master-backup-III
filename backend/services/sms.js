// ============================
// services/sms.js — Hubtel SMS client.
//
// Sends a single SMS via the Hubtel SMSC gateway. Records every attempt
// to sms_log so we have delivery debugging + cost tracking even when
// Hubtel doesn't call our delivery webhook back.
//
// Three operating modes:
//   1. No credentials → log as 'pending' and return without sending.
//      The notifications worker doesn't retry this — there's no provider
//      to talk to. Operator sets credentials in .env to flip it on.
//   2. config.hubtel.mode === 'stub' → log as 'stub' and return.
//      Used for CI / demos where we don't want to bill real SMS.
//   3. Credentials present + mode != 'stub' → real HTTP call to Hubtel.
//      On 2xx + Status=0 → log as 'sent' with the provider message id,
//      otherwise log as 'failed' with the error and throw so the worker
//      can retry on the next tick.
//
// Hubtel API reference (legacy SMSC, still the most widely used in GH):
//   GET https://smsc.hubtel.com/v1/messages/send
//     ?clientid=...&clientsecret=...
//     &from=<senderId>&to=<E.164>&content=<URL-encoded body>
//   Success: { Status: 0, MessageId: "...", Rate: 1.5 }
// ============================

const config = require('../config');
const log    = require('../utils/logger');
const db     = require('../db');
const { normaliseGH } = require('../utils/phone');

const HUBTEL_ENDPOINT = 'https://smsc.hubtel.com/v1/messages/send';
const HTTP_TIMEOUT_MS = 12000;          // Hubtel responds in <2s typically

const insert = () => db.prepare(`
  INSERT INTO sms_log (to_phone, body, provider, provider_id, status,
                       cost, error, related_booking_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

async function send({ to, body, relatedBookingId = null }) {
  const phone    = normaliseGH(to) || to;
  const provider = 'hubtel';

  // Bail early when there's no provider to talk to — record-only mode.
  if (!config.hubtel.clientId || !config.hubtel.clientSecret) {
    log.warn({ to: phone }, 'SMS not sent — Hubtel credentials missing. Logged as pending.');
    const r = insert().run(phone, body, provider, null, 'pending', null, null, relatedBookingId);
    return { id: r.lastInsertRowid, sent: false, stub: true, reason: 'no_credentials' };
  }

  // Stub mode — env-flag for CI / demos. Treated as a successful send
  // for downstream code, but no money or HTTP leaves the building.
  if (String(config.hubtel.mode || '').toLowerCase() === 'stub') {
    const r = insert().run(phone, body, provider, 'stub-' + Date.now(),
                           'sent', 0, null, relatedBookingId);
    return { id: r.lastInsertRowid, sent: true, stub: true };
  }

  // Real send. Build the URL with proper query encoding and call Hubtel.
  // Native fetch comes with Node 18+; we don't need axios/node-fetch.
  const url = new URL(HUBTEL_ENDPOINT);
  url.searchParams.set('clientid',     config.hubtel.clientId);
  url.searchParams.set('clientsecret', config.hubtel.clientSecret);
  url.searchParams.set('from',         config.hubtel.senderId || 'PaintGH');
  url.searchParams.set('to',           phone);
  url.searchParams.set('content',      body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
    const httpStatus = res.status;
    const rawText    = await res.text();
    let payload = {};
    try { payload = JSON.parse(rawText); } catch (_) { /* non-JSON; treat as failure */ }

    // Hubtel returns Status=0 on accepted-for-delivery. Anything else is
    // a client/server problem we should record and retry on the next worker tick.
    if (res.ok && (payload.Status === 0 || payload.status === 0)) {
      const providerId = payload.MessageId || payload.messageId || null;
      const cost       = Number(payload.Rate || payload.rate) || null;
      const r = insert().run(phone, body, provider, providerId, 'sent',
                             cost, null, relatedBookingId);
      log.debug({ id: r.lastInsertRowid, providerId, cost }, 'SMS sent via Hubtel');
      return { id: r.lastInsertRowid, sent: true, providerId, cost };
    }

    // Non-success — Hubtel responded but rejected the request.
    const errMsg = `Hubtel rejected: HTTP ${httpStatus} · ${rawText.slice(0, 200)}`;
    insert().run(phone, body, provider, null, 'failed', null, errMsg, relatedBookingId);
    throw new Error(errMsg);
  } catch (err) {
    if (err.name === 'AbortError') {
      const msg = `Hubtel request timed out after ${HTTP_TIMEOUT_MS}ms`;
      insert().run(phone, body, provider, null, 'failed', null, msg, relatedBookingId);
      throw new Error(msg);
    }
    // If we threw above (already-logged Hubtel rejection), don't double-log.
    if (err.message && err.message.startsWith('Hubtel rejected')) throw err;
    const msg = `Hubtel send error: ${err.message}`;
    insert().run(phone, body, provider, null, 'failed', null, msg, relatedBookingId);
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { send };
