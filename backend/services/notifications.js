// ============================
// services/notifications.js — outbox-first event dispatcher.
//
// Routes don't call Hubtel/Resend directly. Instead they emit an event:
//
//   notifications.emit('booking.assigned', { booking, painter, customer });
//
// The emitter resolves the right template per channel, picks recipients,
// and writes rows into notifications_outbox (status='pending'). A worker
// process (services/notifyWorker.js) drains the table and does the actual
// sends. Two benefits:
//
//   - Route handlers never block on a flaky third-party. POST /bookings
//     returns in <50ms even when Hubtel is having a bad day.
//   - Failed sends are persisted and retryable. Bursts (200 SMS when a
//     region rolls out) drain over time without timing customer-facing
//     requests out.
//
// Events follow the dotted pattern: <entity>.<verb>. Adding a new event
// is one entry in the TEMPLATES map below — no other code touched.
// ============================

const db  = require('../db');
const log = require('../utils/logger');

// ─────────────────────────────────────────────────────────────
// Template registry. Each key is an event name. Each value is an array of
// "delivery instructions" — one per outbox row that should be written.
//
// `recipient` resolves the actual phone/email from the context object the
// caller passes. `body` (and optional `subject`) run over the same context.
// Templates that return null/empty for either field are silently skipped,
// which lets us declare "send email if we have one" without conditionals.
// ─────────────────────────────────────────────────────────────
const TEMPLATES = {
  // ────────── booking lifecycle ──────────
  'booking.created': [
    {
      channel:  'sms',
      recipient: ctx => ctx.customer && ctx.customer.phone,
      body:     ctx => `Paint Masters: We've got your booking ${ctx.booking.id} for ${ctx.booking.service} on ${fmtDate(ctx.booking.job_date)}. A dispatcher will assign a Paint Master within 24 hours.`,
    },
    {
      channel:  'email',
      recipient: ctx => ctx.customer && ctx.customer.email,
      subject:   ctx => `Paint Masters — booking ${ctx.booking.id} received`,
      body:      ctx => `Hi ${firstName(ctx.customer)},\n\nWe've received your booking ${ctx.booking.id} for ${ctx.booking.service} on ${fmtDate(ctx.booking.job_date)} at ${ctx.booking.address}.\n\nA dispatcher will assign one of our Paint Masters and you'll get an SMS as soon as it's done — usually within 24 hours.\n\nThe price you saw on the booking page (${fmtGHS(ctx.booking.total)}) is locked.\n\nTrack the job at: ${trackUrl(ctx.booking.id)}\n\n— Paint Masters`,
    },
  ],

  'booking.assigned': [
    {
      channel:  'sms',
      recipient: ctx => ctx.painter && ctx.painter.phone,
      body:     ctx => `Paint Masters: New job ${ctx.booking.id} on ${fmtDate(ctx.booking.job_date)} (${ctx.booking.duration_days} day${ctx.booking.duration_days===1?'':'s'}). Customer ${firstName(ctx.customer)}, ${ctx.booking.address}. Confirm within 2 hours.`,
    },
    {
      channel:  'sms',
      recipient: ctx => ctx.customer && ctx.customer.phone,
      body:     ctx => `Paint Masters: ${ctx.painter.name} has been assigned to your job ${ctx.booking.id}. They'll confirm shortly.`,
    },
  ],

  'booking.confirmed': [
    {
      channel:  'sms',
      recipient: ctx => ctx.customer && ctx.customer.phone,
      body:     ctx => `Paint Masters: ${ctx.painter.name} has confirmed your job ${ctx.booking.id}. See you on ${fmtDate(ctx.booking.job_date)}.`,
    },
  ],

  'booking.cancelled': [
    {
      channel:  'sms',
      recipient: ctx => ctx.customer && ctx.customer.phone,
      body:     ctx => `Paint Masters: Booking ${ctx.booking.id} cancelled. Refund of ${fmtGHS(ctx.refund && ctx.refund.amount)} will be processed.`,
    },
    {
      channel:  'sms',
      recipient: ctx => ctx.painter && ctx.painter.phone,
      body:     ctx => `Paint Masters: Job ${ctx.booking.id} on ${fmtDate(ctx.booking.job_date)} was cancelled. Your day is free.`,
    },
  ],

  'painter.done': [
    {
      channel:  'sms',
      recipient: ctx => ctx.customer && ctx.customer.phone,
      body:     ctx => `Paint Masters: ${ctx.painter.name} has wrapped up job ${ctx.booking.id}. QA will inspect within 48 hours and then the 12-month warranty kicks in.`,
    },
  ],

  'qa.approved': [
    {
      channel:  'sms',
      recipient: ctx => ctx.customer && ctx.customer.phone,
      body:     ctx => `Paint Masters: Your job ${ctx.booking.id} is complete! 12-month warranty is now active. Thanks for trusting us.`,
    },
    {
      channel:  'sms',
      recipient: ctx => ctx.painter && ctx.painter.phone,
      body:     ctx => `Paint Masters: QA approved job ${ctx.booking.id}. Payout of ${fmtGHS(ctx.payout)} will land in your MoMo within 24 hours.`,
    },
    {
      channel:  'email',
      recipient: ctx => ctx.customer && ctx.customer.email,
      subject:   ctx => `Paint Masters — job ${ctx.booking.id} complete, warranty active`,
      body:      ctx => `Hi ${firstName(ctx.customer)},\n\nGreat news — job ${ctx.booking.id} is complete and signed off by QA. Your 12-month finish warranty is now active.\n\nIf anything peels, blisters or chalks in the next 12 months, raise a claim from your tracker and we'll be back out within 14 business days.\n\nThanks for choosing Paint Masters.\n— The Paint Masters team`,
    },
  ],

  'qa.rejected': [
    {
      channel:  'sms',
      recipient: ctx => ctx.painter && ctx.painter.phone,
      body:     ctx => `Paint Masters: QA flagged issues on job ${ctx.booking.id}.${ctx.reason ? ' Reason: ' + ctx.reason : ''} Please fix and mark done again.`,
    },
  ],

  // ────────── volume gate ──────────
  'volume.confirmed': [
    {
      channel:  'sms',
      recipient: ctx => ctx.customer && ctx.customer.phone,
      body:     ctx => `Paint Masters: Your paint quote ${ctx.quote_id} has been locked in by our dispatcher. The price you saw is final.`,
    },
  ],

  'volume.rejected': [
    {
      channel:  'sms',
      recipient: ctx => ctx.customer && ctx.customer.phone,
      body:     ctx => `Paint Masters: Our dispatcher needs to discuss the paint volume on quote ${ctx.quote_id}. We'll call you shortly.`,
    },
  ],

  // ────────── account ──────────
  'account.welcome': [
    {
      channel:  'sms',
      recipient: ctx => ctx.customer && ctx.customer.phone,
      body:     ctx => `Paint Masters: Welcome, ${firstName(ctx.customer)}! Get an instant quote anytime at paintmasters.gh.`,
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// Template helpers — keep date / currency / firstName formatting consistent
// across every channel so the SMS and email versions of the same event look
// like the same brand.
// ─────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return String(iso); }
}
function fmtGHS(n) {
  if (n == null || !Number.isFinite(Number(n))) return 'GHS 0';
  return 'GH₵' + Math.round(Number(n)).toLocaleString('en-GH');
}
function firstName(person) {
  if (!person || !person.name) return 'there';
  return String(person.name).split(/\s+/)[0];
}
function trackUrl(bookingId) {
  return `https://paintmasters.gh/track?ref=${encodeURIComponent(bookingId || '')}`;
}

// ─────────────────────────────────────────────────────────────
// Public API: emit({ event, ...context }) → Array<outbox row id>
//
// Synchronous SQLite writes. The route handler can fire-and-forget; the
// worker will pick up the row on its next tick and do the actual send.
// ─────────────────────────────────────────────────────────────
const insertStmt = () => db.prepare(`
  INSERT INTO notifications_outbox
    (channel, recipient, template, payload, related_type, related_id, status, scheduled_at)
  VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
`);

function emit(event, context = {}) {
  const template = TEMPLATES[event];
  if (!template) {
    log.warn({ event }, 'notifications.emit called with unknown event');
    return [];
  }

  const relatedType = relatedTypeFor(event);
  const relatedId   = relatedIdFor(event, context);
  const ids = [];

  for (const t of template) {
    const recipient = safe(() => t.recipient(context));
    if (!recipient) continue;   // template can opt out for this run (e.g. customer has no email)
    const body = safe(() => t.body(context)) || '';
    if (!body) continue;

    // For email: stash subject + body together in payload so the worker has
    // both. Keeps the outbox row schema channel-agnostic.
    const payload = JSON.stringify({
      subject: t.subject ? safe(() => t.subject(context)) : null,
      body,
    });

    try {
      const result = insertStmt().run(t.channel, recipient, event, payload, relatedType, relatedId);
      ids.push(result.lastInsertRowid);
    } catch (e) {
      log.error({ event, channel: t.channel, err: e.message }, 'notifications.emit insert failed');
    }
  }
  return ids;
}

function safe(fn) {
  try { return fn(); }
  catch (e) { log.warn({ err: e.message }, 'template eval failed'); return null; }
}

function relatedTypeFor(event) {
  if (event.startsWith('booking.') || event.startsWith('painter.') || event.startsWith('qa.')) return 'booking';
  if (event.startsWith('volume.'))   return 'quote';
  if (event.startsWith('quote.'))    return 'quote';
  if (event.startsWith('account.'))  return 'user';
  return null;
}
function relatedIdFor(event, ctx) {
  if (event.startsWith('booking.') || event.startsWith('painter.') || event.startsWith('qa.')) {
    return ctx.booking && ctx.booking.id || null;
  }
  if (event.startsWith('volume.') || event.startsWith('quote.')) {
    return ctx.quote_id || (ctx.quote && ctx.quote.id) || null;
  }
  if (event.startsWith('account.')) {
    return ctx.customer && (ctx.customer.id || ctx.customer.user_id) || null;
  }
  return null;
}

// Tiny helper for callers that want to know the registered events. Used by
// the verification scripts + future admin UI.
function eventList() { return Object.keys(TEMPLATES).sort(); }

module.exports = { emit, eventList, TEMPLATES };
