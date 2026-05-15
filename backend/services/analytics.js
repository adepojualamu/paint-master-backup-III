// ============================
// services/analytics.js — aggregations powering the admin dashboard.
// Pure SQL, no business logic. Returns plain objects ready for JSON.
// ============================

const db = require('../db');

function revenueByDay({ days = 90 } = {}) {
  return db.prepare(`
    SELECT date(created_at) AS day,
           ROUND(SUM(total), 2) AS revenue,
           COUNT(*)             AS bookings
      FROM bookings
     WHERE created_at >= date('now', '-' || ? || ' days')
       AND status != 'cancelled'
     GROUP BY day
     ORDER BY day
  `).all(days);
}

function serviceMix({ days = 90 } = {}) {
  return db.prepare(`
    SELECT service,
           COUNT(*) AS jobs,
           ROUND(SUM(total), 2) AS revenue
      FROM bookings
     WHERE created_at >= date('now', '-' || ? || ' days')
       AND status != 'cancelled'
     GROUP BY service
     ORDER BY revenue DESC
  `).all(days);
}

function topPainters({ limit = 10 } = {}) {
  return db.prepare(`
    SELECT pp.id, u.name, pp.city, pp.avg_rating, pp.review_count,
           (SELECT COUNT(*) FROM bookings b WHERE b.painter_id = pp.id AND b.status='completed') AS completed_jobs
      FROM painter_profiles pp
      JOIN users u ON u.id = pp.user_id
     ORDER BY (pp.avg_rating * COALESCE(pp.review_count, 0)) DESC, pp.review_count DESC
     LIMIT ?
  `).all(limit);
}

function funnel({ days = 90 } = {}) {
  const range = ` WHERE created_at >= date('now', '-' || ? || ' days') `;
  return {
    quotes:    db.prepare(`SELECT COUNT(*) AS n FROM quotes ${range}`).get(days)?.n || 0,
    bookings:  db.prepare(`SELECT COUNT(*) AS n FROM bookings ${range}`).get(days).n,
    confirmed: db.prepare(`SELECT COUNT(*) AS n FROM bookings ${range} AND status IN ('confirmed','in_progress','completed')`).get(days).n,
    completed: db.prepare(`SELECT COUNT(*) AS n FROM bookings ${range} AND status = 'completed'`).get(days).n,
  };
}

function ratingBreakdown() {
  return db.prepare(`
    SELECT rating, COUNT(*) AS n
      FROM reviews
     WHERE hidden_at IS NULL
     GROUP BY rating
     ORDER BY rating DESC
  `).all();
}

module.exports = { revenueByDay, serviceMix, topPainters, funnel, ratingBreakdown };
