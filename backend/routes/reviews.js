// ============================
// PaintGH — Reviews Routes
// POST /api/reviews              — submit a review [customer, completed booking only]
// GET  /api/reviews/painter/:id  — get all reviews for a painter
// DELETE /api/reviews/:id        — delete a review [admin only]
// ============================

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────
// POST /api/reviews  [customer only]
// Body: { booking_id, rating, comment }
// ─────────────────────────────────────────
router.post('/', protect, restrictTo('customer'), [
  body('booking_id').notEmpty().withMessage('Booking ID required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment max 1000 characters'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { booking_id, rating, comment } = req.body;

  // Verify booking exists and belongs to this customer
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
  if (booking.customer_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'You can only review your own bookings.' });
  }
  if (booking.status !== 'completed') {
    return res.status(400).json({ success: false, message: 'You can only review completed jobs.' });
  }

  // Check if review already submitted
  const existing = db.prepare('SELECT id FROM reviews WHERE booking_id = ?').get(booking_id);
  if (existing) return res.status(409).json({ success: false, message: 'You have already reviewed this booking.' });

  // Insert review
  const result = db.prepare(`
    INSERT INTO reviews (booking_id, painter_id, customer_id, rating, comment)
    VALUES (?, ?, ?, ?, ?)
  `).run(booking_id, booking.painter_id, req.user.id, rating, comment || null);

  // Update painter's avg_rating and review_count
  const stats = db.prepare(`
    SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
    FROM reviews WHERE painter_id = ?
  `).get(booking.painter_id);

  db.prepare(`
    UPDATE painter_profiles
    SET avg_rating = ?, review_count = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(Math.round(stats.avg_rating * 10) / 10, stats.review_count, booking.painter_id);

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully. Thank you!',
    review
  });
});

// ─────────────────────────────────────────
// GET /api/reviews/painter/:painter_id
// Public — anyone can see reviews for a painter
// ─────────────────────────────────────────
router.get('/painter/:painter_id', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const painter = db.prepare('SELECT id FROM painter_profiles WHERE id = ?').get(req.params.painter_id);
  if (!painter) return res.status(404).json({ success: false, message: 'Painter not found.' });

  const total = db.prepare('SELECT COUNT(*) as n FROM reviews WHERE painter_id = ?').get(req.params.painter_id).n;

  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, u.name as customer_name
    FROM reviews r JOIN users u ON u.id = r.customer_id
    WHERE r.painter_id = ?
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.params.painter_id, parseInt(limit), offset);

  const stats = db.prepare(`
    SELECT
      AVG(rating) as avg_rating,
      COUNT(*) as total,
      SUM(CASE WHEN rating=5 THEN 1 ELSE 0 END) as five_star,
      SUM(CASE WHEN rating=4 THEN 1 ELSE 0 END) as four_star,
      SUM(CASE WHEN rating=3 THEN 1 ELSE 0 END) as three_star,
      SUM(CASE WHEN rating=2 THEN 1 ELSE 0 END) as two_star,
      SUM(CASE WHEN rating=1 THEN 1 ELSE 0 END) as one_star
    FROM reviews WHERE painter_id = ?
  `).get(req.params.painter_id);

  res.json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    stats: {
      avg_rating: Math.round((stats.avg_rating || 0) * 10) / 10,
      total: stats.total,
      breakdown: { 5: stats.five_star, 4: stats.four_star, 3: stats.three_star, 2: stats.two_star, 1: stats.one_star }
    },
    reviews
  });
});

// ─────────────────────────────────────────
// DELETE /api/reviews/:id  [admin only]
// ─────────────────────────────────────────
router.delete('/:id', protect, restrictTo('admin'), (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);

  // Recalculate painter stats
  const stats = db.prepare(`
    SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
    FROM reviews WHERE painter_id = ?
  `).get(review.painter_id);

  db.prepare(`
    UPDATE painter_profiles SET avg_rating = ?, review_count = ?, updated_at = datetime('now') WHERE id = ?
  `).run(stats.avg_rating || 0, stats.review_count || 0, review.painter_id);

  res.json({ success: true, message: 'Review deleted.' });
});

module.exports = router;
