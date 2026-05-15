// ============================
// services/sms.js — Hubtel SMS client.
// STATUS: SKELETON. Logs to sms_log and console; no real send until creds set.
// ============================

const config = require('../config');
const log    = require('../utils/logger');
const db     = require('../db');
const { normaliseGH } = require('../utils/phone');

async function send({ to, body, relatedBookingId = null }) {
  const phone = normaliseGH(to) || to;
  const provider = 'hubtel';

  // Always record the attempt — gives us delivery debugging + cost tracking.
  const insert = db.prepare(`
    INSERT INTO sms_log (to_phone, body, provider, status, related_booking_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  if (!config.hubtel.clientId || !config.hubtel.clientSecret) {
    log.warn({ to: phone }, 'SMS not sent — Hubtel credentials missing. Logged as pending.');
    const r = insert.run(phone, body, provider, 'pending', relatedBookingId);
    return { id: r.lastInsertRowid, sent: false, stub: true };
  }

  // TODO: real call —
  //   GET https://smsc.hubtel.com/v1/messages/send?clientid=...&clientsecret=...&from=...&to=...&content=...
  //   On 2xx → status='sent', store provider_id from response
  //   On error → status='failed', store error
  throw new Error('Hubtel live send not implemented yet.');
}

module.exports = { send };
