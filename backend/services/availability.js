// ============================
// services/availability.js — calendar conflict detection across multi-day jobs.
// The booking flow uses isPainterAvailable() before creating a booking.
// ============================

const db = require('../db');
const { daySpan } = require('../utils/dates');

/**
 * Is the painter free for the given span of days?
 *
 * @returns {{ available: boolean, conflicts: Array<{ id: string, job_date: string, duration_days: number }> }}
 */
function isPainterAvailable({ painterId, startDate, durationDays }) {
  const wantedDays = new Set(daySpan(startDate, durationDays));
  // Pull any non-cancelled bookings that could overlap. Cheap on small N; if the
  // painter ever has thousands of bookings we'd window this by date range.
  const candidates = db.prepare(`
    SELECT id, job_date, duration_days
      FROM bookings
     WHERE painter_id = ?
       AND status NOT IN ('cancelled')
  `).all(painterId);

  const conflicts = candidates.filter(b => {
    const span = daySpan(b.job_date, b.duration_days);
    return span.some(d => wantedDays.has(d));
  });

  return { available: conflicts.length === 0, conflicts };
}

/**
 * List the booked dates for a painter in the next N days — useful for a
 * calendar widget on the painter's profile page.
 */
function bookedDates({ painterId, daysAhead = 90 }) {
  const rows = db.prepare(`
    SELECT job_date, duration_days
      FROM bookings
     WHERE painter_id = ?
       AND status NOT IN ('cancelled')
       AND date(job_date) BETWEEN date('now') AND date('now', '+' || ? || ' days')
  `).all(painterId, daysAhead);
  const out = new Set();
  for (const r of rows) for (const d of daySpan(r.job_date, r.duration_days)) out.add(d);
  return Array.from(out).sort();
}

module.exports = { isPainterAvailable, bookedDates };
