// ============================
// services/email.js — Email client (Resend / SendGrid / Mailgun).
// STATUS: SKELETON. Records into email_log; real send is provider-specific.
// ============================

const config = require('../config');
const log    = require('../utils/logger');
const db     = require('../db');

async function send({ to, subject, body, html, relatedBookingId = null }) {
  const insert = db.prepare(`
    INSERT INTO email_log (to_email, subject, body, provider, status, related_booking_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  if (!config.email.provider || !config.email.apiKey) {
    log.warn({ to, subject }, 'Email not sent — provider/api-key missing. Logged as pending.');
    const r = insert.run(to, subject, body || html, '', 'pending', relatedBookingId);
    return { id: r.lastInsertRowid, sent: false, stub: true };
  }

  // TODO: provider-specific dispatch.
  //   resend:    POST https://api.resend.com/emails
  //   sendgrid:  POST https://api.sendgrid.com/v3/mail/send
  //   mailgun:   POST https://api.mailgun.net/v3/{domain}/messages
  throw new Error(`Email provider "${config.email.provider}" not implemented yet.`);
}

module.exports = { send };
