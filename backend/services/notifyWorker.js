// ============================
// services/notifyWorker.js — outbox drain loop.
//
// Reads notifications_outbox in batches, claims each row (status →
// 'sending'), calls the right channel sender (sms / email), then marks
// it sent. Failures get a 'failed' status with attempts++ and an
// exponential back-off; after MAX_ATTEMPTS the row moves to 'dlq' for
// human inspection.
//
// Designed to run inside the Node process — start() is idempotent and
// called from server.js on boot. In production this becomes a separate
// process or BullMQ worker; the API is the same.
// ============================

const db    = require('../db');
const log   = require('../utils/logger');
const sms   = require('./sms');
const email = require('./email');

const POLL_INTERVAL_MS  = 30 * 1000;     // 30s — fast enough for live tracking
const BATCH_SIZE        = 25;            // process up to 25 rows per tick
const MAX_ATTEMPTS      = 5;             // before deadletter
const BACKOFF_BASE_MS   = 60 * 1000;     // 1m → 5m → 25m → 2h → 10h

let _timer = null;
let _running = false;

function start({ intervalMs = POLL_INTERVAL_MS } = {}) {
  if (_timer) return;     // idempotent — guard against duplicate boot calls
  log.info('[notifyWorker] starting');
  // Run one tick on boot so any pending rows from before a restart get drained
  // straight away, then schedule on the interval.
  tick().catch(err => log.error({ err: err.message }, '[notifyWorker] tick failed'));
  _timer = setInterval(() => {
    tick().catch(err => log.error({ err: err.message }, '[notifyWorker] tick failed'));
  }, intervalMs);
  // Don't keep the event loop alive just for the worker.
  if (_timer.unref) _timer.unref();
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

async function tick() {
  if (_running) return;   // never overlap with previous tick (long Hubtel responses are real)
  _running = true;
  try {
    // Claim a batch — pending OR failed-with-attempts-remaining, scheduled_at
    // passed. Flip status to 'sending' inside a single statement so two
    // worker instances (today: just us; future: scale-out) can't double-process.
    const rows = db.prepare(`
      SELECT id, channel, recipient, template, payload,
             related_type, related_id, attempts
        FROM notifications_outbox
       WHERE status IN ('pending', 'failed')
         AND attempts < ?
         AND scheduled_at <= datetime('now')
       ORDER BY scheduled_at, id
       LIMIT ?
    `).all(MAX_ATTEMPTS, BATCH_SIZE);

    if (!rows.length) return;

    const claim = db.prepare(`
      UPDATE notifications_outbox
         SET status = 'sending', updated_at = datetime('now')
       WHERE id = ? AND status IN ('pending', 'failed')
    `);
    const success = db.prepare(`
      UPDATE notifications_outbox
         SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?
    `);
    const failure = db.prepare(`
      UPDATE notifications_outbox
         SET status = ?, last_error = ?, attempts = attempts + 1,
             scheduled_at = ?, updated_at = datetime('now')
       WHERE id = ?
    `);

    for (const row of rows) {
      const claimed = claim.run(row.id).changes;
      if (!claimed) continue;     // someone else got there first

      let payload;
      try { payload = JSON.parse(row.payload || '{}'); }
      catch { payload = { body: '' }; }

      try {
        if (row.channel === 'sms') {
          await sms.send({
            to:               row.recipient,
            body:             payload.body || '',
            relatedBookingId: row.related_type === 'booking' ? row.related_id : null,
          });
        } else if (row.channel === 'email') {
          await email.send({
            to:               row.recipient,
            subject:          payload.subject || 'Paint Masters',
            body:             payload.body || '',
            relatedBookingId: row.related_type === 'booking' ? row.related_id : null,
          });
        } else {
          throw new Error(`Unknown channel: ${row.channel}`);
        }
        success.run(row.id);
        log.debug({ id: row.id, channel: row.channel, template: row.template }, '[notifyWorker] sent');
      } catch (err) {
        const nextAttempts = (row.attempts || 0) + 1;
        const terminal = nextAttempts >= MAX_ATTEMPTS;
        // Exponential back-off: 1m, 5m, 25m, ...  capped by MAX_ATTEMPTS
        const backoffMs = BACKOFF_BASE_MS * Math.pow(5, row.attempts || 0);
        const nextRun = new Date(Date.now() + backoffMs).toISOString().replace('T', ' ').slice(0, 19);
        failure.run(
          terminal ? 'dlq' : 'failed',
          String(err && err.message || err).slice(0, 500),
          nextRun,
          row.id,
        );
        log.warn({
          id: row.id, channel: row.channel, template: row.template,
          attempts: nextAttempts, terminal, err: err && err.message,
        }, '[notifyWorker] send failed');
      }
    }
  } finally {
    _running = false;
  }
}

// One-shot drain — useful for tests and the verification script.
async function drain() { await tick(); }

module.exports = { start, stop, tick, drain };
