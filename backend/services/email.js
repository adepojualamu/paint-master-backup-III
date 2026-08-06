// ============================
// services/email.js — transactional email client (Resend / SendGrid / Mailgun).
//
// Sends a single email and records every attempt to email_log so we have a
// delivery trail even when the provider doesn't call a webhook back. This is
// the email sibling of services/sms.js and follows the exact same contract.
//
// Three operating modes:
//   1. No provider / no API key → log as 'pending' and return without
//      sending. The notifications worker doesn't retry this — there's no
//      provider to talk to. Set EMAIL_PROVIDER + EMAIL_API_KEY in .env to
//      flip it on; no other code changes needed.
//   2. config.email.mode === 'stub' → log as 'sent' and return.
//      Used for CI / demos where we don't want to burn provider quota.
//   3. Provider + key present, mode != 'stub' → real HTTPS call.
//      On success → log 'sent' with the provider message id.
//      On failure → log 'failed' with the error and throw so the worker
//      retries on its next tick (exponential back-off → DLQ after 5 tries).
//
// Supported providers (set EMAIL_PROVIDER):
//   resend    POST https://api.resend.com/emails             Bearer <key>
//   sendgrid  POST https://api.sendgrid.com/v3/mail/send      Bearer <key>
//   mailgun   POST {base}/v3/{domain}/messages               Basic api:<key>
//             (needs MAILGUN_DOMAIN; EU accounts set MAILGUN_BASE_URL to
//              https://api.eu.mailgun.net)
//
// Native fetch ships with Node 18+, so no axios / node-fetch dependency.
// ============================

const config = require('../config');
const log    = require('../utils/logger');
const db     = require('../db');

const HTTP_TIMEOUT_MS = 15000;          // providers usually respond in <2s

// ─────────────────────────────────────────────────────────────
// email_log writer. Columns: to_email, subject, body, provider, provider_id,
// status, error, related_booking_id. to_email + subject are NOT NULL; the
// rest are nullable. Returns the new row id.
// ─────────────────────────────────────────────────────────────
function logRow({ to, subject, body, provider = '', providerId = null, status, error = null }, relatedBookingId = null) {
  const stmt = db.prepare(`
    INSERT INTO email_log (to_email, subject, body, provider, provider_id,
                           status, error, related_booking_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(to, subject, body || null, provider || null, providerId,
                  status, error, relatedBookingId).lastInsertRowid;
}

// "Paint Masters <no-reply@paintgh.com>" when a display name is set,
// otherwise the bare address. All three providers accept this RFC 5322 form.
function fromHeader() {
  const addr = config.email.from;
  const name = config.email.fromName;
  return name ? `${name} <${addr}>` : addr;
}

// fetch() wrapper with an abort-based timeout, mirroring services/sms.js.
async function httpRequest(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Email request timed out after ${HTTP_TIMEOUT_MS}ms`);
    }
    throw new Error(`Email network error: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────
// Provider adapters. Each takes the normalised message and returns
// { providerId } on success, or throws an Error describing the rejection.
// ─────────────────────────────────────────────────────────────

// Resend — https://resend.com/docs/api-reference/emails/send-email
async function sendResend({ to, subject, text, html }) {
  const res = await httpRequest('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.email.apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    fromHeader(),
      to:      [to],
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    }),
  });

  const raw = await res.text();
  let payload = {};
  try { payload = JSON.parse(raw); } catch (_) { /* non-JSON body */ }

  if (!res.ok) {
    const detail = payload.message || payload.name || raw.slice(0, 200);
    throw new Error(`Resend rejected: HTTP ${res.status} · ${detail}`);
  }
  return { providerId: payload.id || null };
}

// SendGrid — https://docs.sendgrid.com/api-reference/mail-send/mail-send
// Returns 202 Accepted with an empty body; the message id is in a header.
async function sendSendgrid({ to, subject, text, html }) {
  const content = [];
  if (text) content.push({ type: 'text/plain', value: text });
  if (html) content.push({ type: 'text/html',  value: html });
  if (!content.length) content.push({ type: 'text/plain', value: ' ' });

  const from = { email: config.email.from };
  if (config.email.fromName) from.name = config.email.fromName;

  const res = await httpRequest('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.email.apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from,
      subject,
      content,
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    throw new Error(`SendGrid rejected: HTTP ${res.status} · ${raw.slice(0, 200)}`);
  }
  return { providerId: res.headers.get('x-message-id') || null };
}

// Mailgun — https://documentation.mailgun.com/docs/mailgun/api-reference/openapi-final/tag/Messages/
// Form-encoded body, HTTP Basic auth with username "api".
async function sendMailgun({ to, subject, text, html }) {
  const domain = config.email.mailgunDomain;
  if (!domain) {
    throw new Error('Mailgun selected but MAILGUN_DOMAIN is not set in .env.');
  }
  const base = String(config.email.mailgunBaseUrl || 'https://api.mailgun.net').replace(/\/+$/, '');

  const form = new URLSearchParams();
  form.set('from',    fromHeader());
  form.set('to',      to);
  form.set('subject', subject);
  if (text) form.set('text', text);
  if (html) form.set('html', html);
  if (!text && !html) form.set('text', ' ');   // Mailgun needs a body part

  const res = await httpRequest(`${base}/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`api:${config.email.apiKey}`).toString('base64'),
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const raw = await res.text();
  let payload = {};
  try { payload = JSON.parse(raw); } catch (_) { /* non-JSON body */ }

  if (!res.ok) {
    const detail = payload.message || raw.slice(0, 200);
    throw new Error(`Mailgun rejected: HTTP ${res.status} · ${detail}`);
  }
  return { providerId: payload.id || null };
}

const PROVIDERS = {
  resend:   sendResend,
  sendgrid: sendSendgrid,
  mailgun:  sendMailgun,
};

// ─────────────────────────────────────────────────────────────
// Public API: send({ to, subject, body, html, relatedBookingId })
// `body` is the plain-text version; `html` is optional. The notifications
// worker passes the template's plain-text body; html stays null for now.
// ─────────────────────────────────────────────────────────────
async function send({ to, subject, body, html, relatedBookingId = null }) {
  const provider = String(config.email.provider || '').toLowerCase();
  const text     = body || '';
  const archive  = body || html || '';     // what we keep in email_log.body

  // Mode 1 — record-only. No provider configured: queue it, don't send.
  if (!provider || !config.email.apiKey) {
    log.warn({ to, subject }, 'Email not sent — provider/api-key missing. Logged as pending.');
    const id = logRow({ to, subject, body: archive, provider: provider, status: 'pending' }, relatedBookingId);
    return { id, sent: false, stub: true, reason: 'no_credentials' };
  }

  // Mode 2 — stub. Env-flag for CI / demos. Counts as a successful send for
  // downstream code, but no HTTP leaves the building and no quota is burned.
  if (String(config.email.mode || '').toLowerCase() === 'stub') {
    const id = logRow({
      to, subject, body: archive, provider,
      providerId: 'stub-' + Date.now(), status: 'sent',
    }, relatedBookingId);
    return { id, sent: true, stub: true };
  }

  // Mode 3 — real send.
  const sender = PROVIDERS[provider];
  if (!sender) {
    const msg = `Unknown EMAIL_PROVIDER "${provider}" — expected resend, sendgrid or mailgun.`;
    logRow({ to, subject, body: archive, provider, status: 'failed', error: msg }, relatedBookingId);
    throw new Error(msg);
  }

  try {
    const { providerId } = await sender({ to, subject, text, html: html || null });
    const id = logRow({ to, subject, body: archive, provider, providerId, status: 'sent' }, relatedBookingId);
    log.debug({ id, provider, providerId }, 'Email sent');
    return { id, sent: true, providerId };
  } catch (err) {
    const msg = String(err && err.message || err);
    logRow({ to, subject, body: archive, provider, status: 'failed', error: msg }, relatedBookingId);
    // Re-throw so notifyWorker records the failure and retries on the next tick.
    throw new Error(msg);
  }
}

module.exports = { send };
