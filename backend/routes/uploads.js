// ============================
// routes/uploads.js — customer-uploaded job progress photos.
//
// Flow: customer hits POST /api/uploads/job-photo from the project tracker
// (track.html). Multer writes the file to backend/uploads/job-photos/<ref>/
// keyed by sha256 hash. A row goes into job_photo_uploads with status
// 'pending'. The admin queues GET /api/admin/uploads/pending and approves
// or rejects via PATCH. Approved photos are served from GET /api/uploads/
// job-photo/:id (open to anyone with the URL since the URL embeds the
// numeric id; we don't gate by role today, matching how the warranty
// certificate page is reachable).
//
// Storage: local filesystem under config.uploads.localDir (defaults to
// `backend/uploads/`). Cloud storage (S3 / R2) is a single-file swap of
// the multer storage engine + this file's serve handler.
// ============================

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const multer   = require('multer');

const db          = require('../db');
const config      = require('../config');
const log         = require('../utils/logger');
const asyncHandler = require('../middleware/asyncHandler');
const { protect, restrictTo } = require('../middleware/auth');
const { notFound, badRequest, forbidden } = require('../utils/errors');

const router = express.Router();

// Resolve the on-disk root for uploads. Created on first use so the dev
// machine doesn't need a manual `mkdir`.
const UPLOAD_ROOT = path.resolve(
  process.cwd(),
  config.uploads.localDir || './uploads',
  'job-photos'
);
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

// Multer config — disk storage, 8MB cap, image MIME only.
const upload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      // Per-booking subfolder. The customer's booking ref is on the form body
      // as `bookingRef`; multer parses fields BEFORE files when the field
      // ordering on the request body is preserved (the customer-side upload
      // sends `bookingRef` first by convention).
      const ref = String(req.body.bookingRef || 'unknown').replace(/[^A-Z0-9-]/gi, '');
      const dir = path.join(UPLOAD_ROOT, ref || 'unknown');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      // Hash the original name + a timestamp so we never collide.
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      const sha = crypto
        .createHash('sha256')
        .update(file.originalname + Date.now() + Math.random())
        .digest('hex')
        .slice(0, 16);
      cb(null, `${sha}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter(_req, file, cb) {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype || '')) {
      return cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed.'));
    }
    cb(null, true);
  }
});

// ─────────────────────────────────────────────
// POST /api/uploads/job-photo
//
// Multipart fields:
//   file        — the image (required)
//   bookingRef  — booking ref this photo belongs to (required)
//   caption     — optional one-line caption from the customer
//
// Customer auth required. Inserts a 'pending' row into job_photo_uploads
// and returns { id, status, storage_path } so the frontend can render the
// "Pending review" badge for this photo.
// ─────────────────────────────────────────────
router.post('/job-photo',
  protect,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No file uploaded.');
    const bookingRef = String(req.body.bookingRef || '').trim();
    if (!bookingRef) {
      // Multer already wrote the file — clean up.
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      throw badRequest('bookingRef is required.');
    }
    const caption = (req.body.caption || '').toString().slice(0, 280);

    // Look up the booking so we can attach customer_id properly.
    const booking = db.prepare('SELECT id, customer_id FROM bookings WHERE id = ?').get(bookingRef);
    if (!booking) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      throw notFound('Booking not found.');
    }
    if (booking.customer_id !== req.user.id && req.user.role !== 'admin') {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      throw forbidden('You can only upload photos to your own bookings.');
    }

    // Path stored in DB is relative to the uploads root, so swapping cloud
    // storage later doesn't require rewriting historical rows.
    const relPath = path.relative(
      path.resolve(process.cwd(), config.uploads.localDir || './uploads'),
      req.file.path
    );

    const insert = db.prepare(`
      INSERT INTO job_photo_uploads
        (booking_id, customer_id, filename, original_name, mime_type, size_bytes, storage_path, status, caption)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      booking.id,
      booking.customer_id,
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      relPath,
      caption || null
    );

    log.info({ id: insert.lastInsertRowid, bookingRef, size: req.file.size }, 'job photo uploaded');
    res.status(201).json({
      success: true,
      photo: {
        id: insert.lastInsertRowid,
        status: 'pending',
        url: `/api/uploads/job-photo/${insert.lastInsertRowid}`,
        caption,
        message: 'Awaiting admin review. You\'ll see it on the tracker once approved.'
      }
    });
  })
);

// ─────────────────────────────────────────────
// GET /api/uploads/job-photo/:id
//
// Serves the file. Status check: pending uploads only visible to the
// uploader (or admin); approved are visible to the booking's customer +
// painter + admin; rejected hidden from everyone but admin.
// ─────────────────────────────────────────────
router.get('/job-photo/:id',
  protect,
  asyncHandler(async (req, res) => {
    const row = db.prepare(`
      SELECT u.*, b.painter_id, p.user_id AS painter_user_id
        FROM job_photo_uploads u
        JOIN bookings b ON b.id = u.booking_id
        LEFT JOIN painter_profiles p ON p.id = b.painter_id
       WHERE u.id = ?
    `).get(req.params.id);
    if (!row) throw notFound('Photo not found.');

    const isAdmin    = req.user.role === 'admin';
    const isCustomer = req.user.id === row.customer_id;
    const isPainter  = req.user.id === row.painter_user_id;
    if (row.status === 'rejected' && !isAdmin)             throw notFound('Photo not found.');
    if (row.status === 'pending'  && !(isAdmin || isCustomer)) throw forbidden('Pending photo.');
    if (row.status === 'approved' && !(isAdmin || isCustomer || isPainter)) throw forbidden('Not your booking.');

    const abs = path.resolve(
      process.cwd(),
      config.uploads.localDir || './uploads',
      row.storage_path
    );
    if (!fs.existsSync(abs)) throw notFound('File missing on disk.');
    res.set('Cache-Control', 'private, max-age=300');
    res.set('Content-Type', row.mime_type);
    fs.createReadStream(abs).pipe(res);
  })
);

// ─────────────────────────────────────────────
// GET /api/admin/uploads/pending
//
// The moderation queue. Admin-only.
// ─────────────────────────────────────────────
router.get('/admin/pending',
  protect, restrictTo('admin'),
  asyncHandler(async (_req, res) => {
    const rows = db.prepare(`
      SELECT u.id, u.booking_id, u.original_name, u.mime_type, u.size_bytes,
             u.uploaded_at, u.caption,
             usr.name AS customer_name, b.address
        FROM job_photo_uploads u
        JOIN bookings b ON b.id = u.booking_id
        JOIN users    usr ON usr.id = u.customer_id
       WHERE u.status = 'pending'
       ORDER BY u.uploaded_at ASC
    `).all();
    res.json({ success: true, count: rows.length, photos: rows });
  })
);

// ─────────────────────────────────────────────
// PATCH /api/admin/uploads/:id
//   body: { action: 'approve' | 'reject', reason?: string }
//
// Approves or rejects a pending photo. Approving moves status → 'approved'
// and stamps approved_by + approved_at. Rejecting moves status → 'rejected'
// and stores the reason; the file stays on disk for audit but is hidden
// from the customer's tracker.
// ─────────────────────────────────────────────
router.patch('/admin/:id',
  protect, restrictTo('admin'),
  asyncHandler(async (req, res) => {
    const action = String(req.body.action || '').toLowerCase();
    if (action !== 'approve' && action !== 'reject') throw badRequest('action must be "approve" or "reject".');
    const reason = action === 'reject' ? String(req.body.reason || '').slice(0, 280) : null;

    const row = db.prepare('SELECT id, status FROM job_photo_uploads WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Photo not found.');
    if (row.status !== 'pending') throw badRequest(`Photo already ${row.status}.`);

    if (action === 'approve') {
      db.prepare(`
        UPDATE job_photo_uploads
           SET status = 'approved', approved_at = datetime('now'), approved_by = ?
         WHERE id = ?
      `).run(req.user.id, req.params.id);
    } else {
      db.prepare(`
        UPDATE job_photo_uploads
           SET status = 'rejected', rejected_reason = ?
         WHERE id = ?
      `).run(reason, req.params.id);
    }
    res.json({ success: true, id: Number(req.params.id), status: action === 'approve' ? 'approved' : 'rejected' });
  })
);

module.exports = router;
