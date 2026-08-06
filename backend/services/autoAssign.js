// ============================
// services/autoAssign.js — system-driven painter assignment with an admin gate.
//
// Flow:
//   1. A customer booking is created → status='pending_assignment', painter_id NULL.
//   2. autoAssignBooking() picks the best eligible + available painter and
//      moves the booking to status='pending_approval' (painter attached, but
//      NOT yet notified). assignment_mode='auto'.
//   3. A dispatcher approves (→ 'pending', painter notified), rejects (painter
//      is excluded and the next best is proposed), or reassigns to a specific
//      painter. Those transitions live in routes/bookings.js.
//
// "Best" painter, among those who are eligible (offer the service, not
// suspended, not previously rejected for this booking) AND available for the
// job's date span:
//     1) fewest active jobs   — spreads work fairly across the roster
//     2) highest avg_rating   — tie-break toward quality
//     3) lowest id            — final deterministic tie-break (stable, testable)
//
// start()/stop() run a periodic safety sweep so bookings that had no free
// painter at creation time get picked up automatically once someone frees up.
// Mirrors services/notifyWorker.js: idempotent, self-unref'ing timer, started
// from server.js only when the process is actually serving.
// ============================

const db           = require('../db');
const log          = require('../utils/logger');
const availability = require('./availability');

let audit = null;
try { audit = require('./audit'); } catch (_) { /* audit optional */ }

// Statuses that mean a painter is actively committed to a job. Used to count a
// painter's current workload for the fairness ranking. Anything terminal
// (completed / cancelled) or unassigned doesn't count against them.
const ACTIVE_JOB_STATUSES = ['pending_approval', 'pending', 'confirmed', 'in_progress', 'qa_pending'];

// Capacity cap: the most active jobs a painter may hold before the auto-assigner
// stops proposing them. "Fairest workload" spreads jobs evenly, but without a
// ceiling a small roster still funnels everything to whoever is least-loaded;
// this guarantees nobody is auto-loaded past a sane limit. A dispatcher can
// still manually assign past it via PUT /:id/assign. Override with the
// AUTO_ASSIGN_MAX_ACTIVE_JOBS env var; 0 or negative disables the cap.
const MAX_ACTIVE_JOBS = (() => {
  const n = parseInt(process.env.AUTO_ASSIGN_MAX_ACTIVE_JOBS, 10);
  return Number.isFinite(n) ? n : 5;
})();

const SWEEP_INTERVAL_MS = 2 * 60 * 1000;   // 2 minutes
const SWEEP_BATCH       = 100;

// ---------------------------------------------------------------------------
// Candidate selection
// ---------------------------------------------------------------------------

/**
 * How many active (non-terminal) jobs a painter currently holds.
 */
function activeJobCount(painterId) {
  const placeholders = ACTIVE_JOB_STATUSES.map(() => '?').join(',');
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM bookings
      WHERE painter_id = ? AND status IN (${placeholders})`
  ).get(painterId, ...ACTIVE_JOB_STATUSES);
  return row ? row.n : 0;
}

/**
 * Collect painters who are not suspended, not excluded, and free for the dates.
 * When `service` is given, only painters offering it are considered. The
 * services column is a JSON array of labels like ["Interior","Exterior"], so a
 * LIKE on the quoted label is a cheap containment test — the same trick
 * routes/painters.js uses for its public filter.
 */
function _availableCandidates({ service, jobDate, durationDays, exclude }) {
  const params = [];
  let sql = `
    SELECT pp.id, pp.avg_rating, u.name AS painter_name
      FROM painter_profiles pp
      JOIN users u ON u.id = pp.user_id
     WHERE pp.suspended_at IS NULL`;
  if (service) { sql += ` AND pp.services LIKE ?`; params.push(`%"${service}"%`); }

  const out = [];
  for (const p of db.prepare(sql).all(...params)) {
    if (exclude.has(Number(p.id))) continue;
    const avail = availability.isPainterAvailable({ painterId: p.id, startDate: jobDate, durationDays });
    if (!avail.available) continue;
    const active = activeJobCount(p.id);
    if (MAX_ACTIVE_JOBS > 0 && active >= MAX_ACTIVE_JOBS) continue;   // at capacity — don't auto-load further
    out.push({
      id:          p.id,
      name:        p.painter_name,
      avg_rating:  Number(p.avg_rating) || 0,
      active_jobs: active,
    });
  }
  return out;
}

/**
 * Find the best painter for a job, or null if none is eligible + available.
 *
 * Service match is a PREFERENCE, not a hard gate: we first look for a free
 * painter who offers the service, and only if none exists do we fall back to
 * any free painter — flagged with service_match=false so the dispatcher can see
 * the proposal is outside the painter's usual services before approving.
 *
 * @param {object}   opts
 * @param {string}   opts.service       booking.service (e.g. 'Interior')
 * @param {string}   opts.jobDate       ISO start date
 * @param {number}   opts.durationDays  job length in days
 * @param {number[]} [opts.excludeIds]  painter ids to skip (e.g. already rejected)
 * @returns {null | { id, name, avg_rating, active_jobs, service_match }}
 */
function findBestPainter({ service, jobDate, durationDays, excludeIds = [] }) {
  const exclude = new Set((excludeIds || []).map(Number));

  // Pass 1: painters who offer the service.
  let candidates = _availableCandidates({ service, jobDate, durationDays, exclude });
  let serviceMatch = true;

  // Pass 2 (fallback): if nobody offers the service, consider any free painter.
  if (!candidates.length && service) {
    candidates = _availableCandidates({ service: null, jobDate, durationDays, exclude });
    serviceMatch = false;
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) =>
    (a.active_jobs - b.active_jobs) ||       // fewest active jobs first
    (b.avg_rating  - a.avg_rating)  ||       // then highest rating
    (a.id - b.id)                            // stable final tie-break
  );

  return { ...candidates[0], service_match: serviceMatch };
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

/**
 * Attempt to auto-propose a painter for one booking.
 *
 * Only acts on bookings that are genuinely awaiting assignment
 * (status='pending_assignment', painter_id NULL). On success the booking moves
 * to status='pending_approval' with the painter attached (assignment_mode='auto').
 * The painter is deliberately NOT notified here — that happens when a dispatcher
 * approves the proposal.
 *
 * @returns {{ assigned: boolean, reason?: string, painter?: object }}
 */
function autoAssignBooking(bookingId, { actorId = null } = {}) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) return { assigned: false, reason: 'not_found' };
  if (booking.status !== 'pending_assignment' || booking.painter_id != null) {
    return { assigned: false, reason: 'not_awaiting_assignment' };
  }

  let excludeIds = [];
  try { excludeIds = JSON.parse(booking.rejected_painter_ids || '[]'); } catch (_) { excludeIds = []; }

  const best = findBestPainter({
    service:      booking.service,
    jobDate:      booking.job_date,
    durationDays: booking.duration_days,
    excludeIds,
  });
  if (!best) return { assigned: false, reason: 'no_candidate' };

  // Guarded UPDATE — the WHERE re-asserts the pre-state so two concurrent
  // sweeps (or a sweep racing the create-time call) can't both claim it.
  const res = db.prepare(`
    UPDATE bookings
       SET painter_id = ?, status = 'pending_approval',
           assignment_mode = 'auto', updated_at = datetime('now')
     WHERE id = ? AND status = 'pending_assignment' AND painter_id IS NULL
  `).run(best.id, bookingId);

  if (res.changes === 0) return { assigned: false, reason: 'raced' };

  if (audit) {
    try {
      audit.record({
        action:     'booking.auto_proposed',
        entityType: 'booking',
        entityId:   bookingId,
        actorId,
        actorRole:  'system',
        payload:    JSON.stringify({ painter_id: best.id, active_jobs: best.active_jobs, avg_rating: best.avg_rating, service_match: best.service_match }),
      });
    } catch (_) { /* audit is best-effort */ }
  }

  log.info({ bookingId, painterId: best.id, activeJobs: best.active_jobs, serviceMatch: best.service_match },
    '[autoAssign] proposed painter (awaiting approval)');
  return { assigned: true, painter: best };
}

/**
 * Sweep every still-unassigned booking and try to propose a painter for each.
 * Per-booking failures are swallowed so one bad row can't stall the batch.
 *
 * @returns {{ scanned: number, assigned: number }}
 */
function sweepUnassigned({ limit = SWEEP_BATCH } = {}) {
  const rows = db.prepare(`
    SELECT id FROM bookings
     WHERE status = 'pending_assignment' AND painter_id IS NULL
     ORDER BY created_at ASC
     LIMIT ?
  `).all(limit);

  let assigned = 0;
  for (const r of rows) {
    try {
      const out = autoAssignBooking(r.id);
      if (out.assigned) assigned++;
    } catch (err) {
      log.error({ bookingId: r.id, err: err.message }, '[autoAssign] sweep row failed');
    }
  }
  if (rows.length) log.info({ scanned: rows.length, assigned }, '[autoAssign] sweep complete');
  return { scanned: rows.length, assigned };
}

// ---------------------------------------------------------------------------
// Background sweep loop (mirrors notifyWorker)
// ---------------------------------------------------------------------------

let _timer = null;
let _running = false;

function _tick() {
  if (_running) return;   // never overlap
  _running = true;
  try { sweepUnassigned(); }
  catch (err) { log.error({ err: err.message }, '[autoAssign] tick failed'); }
  finally { _running = false; }
}

function start({ intervalMs = SWEEP_INTERVAL_MS } = {}) {
  if (_timer) return;     // idempotent
  log.info('[autoAssign] starting sweep loop');
  _tick();                // catch anything queued before boot
  _timer = setInterval(_tick, intervalMs);
  if (_timer.unref) _timer.unref();   // don't keep the process alive for it
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = {
  findBestPainter,
  autoAssignBooking,
  sweepUnassigned,
  activeJobCount,
  start,
  stop,
  ACTIVE_JOB_STATUSES,
  MAX_ACTIVE_JOBS,
};
