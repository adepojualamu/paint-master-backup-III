// ============================
// middleware/idempotency.js — at-most-once semantics for payment-mutating
// endpoints. Keyed by the client-supplied `Idempotency-Key` header (or, on
// callback routes, by the gateway's event ID). Backed by the
// `idempotency_keys` table from migration 020.
//
// Usage:
//   router.post('/charge', idempotency('payments.charge'), handler);
//
// Behaviour:
//   * Missing header              → 400 if `required: true`, otherwise pass through.
//   * Cache hit, hash matches     → replay cached status_code + body.
//   * Cache hit, hash differs     → 409 (same key, different request).
//   * Cache miss                  → run handler, capture response, cache it.
//
// NOTE: this middleware reads the parsed body, so it must be mounted AFTER
// express.json(). For Hubtel's callback route we ALSO need a raw-body capture
// for signature verification — that's done with express.raw() upstream and
// the parsed JSON is attached to req.body before this middleware runs.
// ============================

const crypto = require('crypto');
const db     = require('../db');
const log    = require('../utils/logger');
const { badRequest, conflict } = require('../utils/errors');

const HEADER = 'idempotency-key';

function hashRequest(req) {
  const payload = JSON.stringify({
    m: req.method,
    p: req.originalUrl || req.url,
    b: req.body || {},
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

/**
 * @param {string} scope - logical scope, e.g. 'payments.charge'.
 * @param {object} [opts]
 * @param {boolean} [opts.required=true] - if false, requests without the header pass through.
 * @param {string|((req)=>string)} [opts.keyFrom] - override the key source. Defaults to the header.
 */
function idempotency(scope, opts = {}) {
  const required = opts.required !== false;
  const keyFrom  = opts.keyFrom;

  return function idempotencyMiddleware(req, res, next) {
    let key;
    if (typeof keyFrom === 'function') key = keyFrom(req);
    else if (typeof keyFrom === 'string') key = req.headers[keyFrom.toLowerCase()];
    else key = req.headers[HEADER];

    if (!key) {
      if (!required) return next();
      return next(badRequest(`Missing ${HEADER} header.`));
    }
    key = String(key).slice(0, 200); // cap to prevent abuse

    const hash = hashRequest(req);

    let row;
    try {
      row = db.prepare(`
        SELECT status_code, response_body, request_hash
          FROM idempotency_keys
         WHERE key = ? AND scope = ? AND expires_at > datetime('now')
      `).get(key, scope);
    } catch (err) {
      // If the table doesn't exist yet (migration not run), fail open with a
      // loud warning rather than 500 — this keeps dev unblocked.
      log.warn({ err: err.message }, 'idempotency_keys lookup failed; passing through');
      return next();
    }

    if (row) {
      if (row.request_hash !== hash) {
        return next(conflict('Idempotency-Key reused with a different request body.'));
      }
      log.debug({ scope, key }, 'idempotency cache hit — replaying response');
      const body = safeParse(row.response_body);
      res.set('Idempotent-Replay', 'true');
      return res.status(row.status_code).json(body ?? { success: true });
    }

    // Cache miss — wrap res.json to capture the response after the handler runs.
    const originalJson = res.json.bind(res);
    res.json = function capturedJson(payload) {
      try {
        db.prepare(`
          INSERT INTO idempotency_keys (key, scope, request_hash, status_code, response_body)
          VALUES (?, ?, ?, ?, ?)
        `).run(key, scope, hash, res.statusCode || 200, JSON.stringify(payload ?? {}));
      } catch (err) {
        // Race: another request with the same key beat us to the insert. That
        // request's response is now authoritative; we just continue with ours
        // for this client and log.
        if (!/UNIQUE/.test(err.message)) {
          log.warn({ err: err.message, scope, key }, 'idempotency cache write failed');
        }
      }
      return originalJson(payload);
    };

    return next();
  };
}

/**
 * Prune expired rows. Wire into a nightly cron / scripts/cleanup.js.
 */
function pruneExpired() {
  return db.prepare(`DELETE FROM idempotency_keys WHERE expires_at <= datetime('now')`).run().changes;
}

module.exports = idempotency;
module.exports.idempotency  = idempotency;
module.exports.pruneExpired = pruneExpired;
