// ============================
// Quotes routes — saved quotes that can convert into bookings/contracts.
//
// The customer-facing quote.html computes a price client-side. On submit
// (quote.html → booking.html) the front-end POSTs here to persist a quote
// record. The request can optionally include `paintLines: [{ paint_product_id,
// area_sqm, coats }]`, in which case each line is also persisted via
// services/paintVolume.recordEstimate(), flipping the quote into
// volume_status='pending_review' atomically — the dispatcher review screen
// then picks it up.
//
// Endpoints:
//   POST   /api/quotes            create (anon or auth'd)
//   GET    /api/quotes            list (admin sees all; customer sees own)
//   GET    /api/quotes/:id        fetch one (with volume estimate lines)
//   PUT    /api/quotes/:id/finalize  guarded by paintVolume.assertVolumeConfirmed
// ============================

const express = require('express');
const { body, param } = require('express-validator');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const db            = require('../db');
const config        = require('../config');
const C             = require('../config/constants');
const validate      = require('../middleware/validate');
const asyncHandler  = require('../middleware/asyncHandler');
const { protect, restrictTo } = require('../middleware/auth');
const { calculateQuote } = require('../services/pricing');
const rateCard      = require('../services/rateCard');
const paintVolume   = require('../services/paintVolume');
const ids           = require('../utils/ids');
const { notFound, badRequest, forbidden } = require('../utils/errors');

const router = express.Router();

// ----- quote space-photo uploads ---------------------------------------
// Customers can attach photos of the space to be painted while finalizing a
// quote. Files land on disk under UPLOADS_LOCAL_DIR/quote-photos/<quoteId>/;
// the quote_photos table holds the metadata. Mirrors routes/uploads.js.
const QUOTE_PHOTO_ROOT = path.resolve(
  process.cwd(), config.uploads.localDir || './uploads', 'quote-photos'
);
if (!fs.existsSync(QUOTE_PHOTO_ROOT)) fs.mkdirSync(QUOTE_PHOTO_ROOT, { recursive: true });

const photoUpload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      // The quote id is a route param, so it's available here before files.
      const qid = String(req.params.id || 'unknown').replace(/[^A-Za-z0-9-]/g, '');
      const dir = path.join(QUOTE_PHOTO_ROOT, qid || 'unknown');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      const sha = crypto.createHash('sha256')
        .update(file.originalname + Date.now() + Math.random())
        .digest('hex').slice(0, 16);
      cb(null, `${sha}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },   // 8 MB each, max 8
  fileFilter(_req, file, cb) {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype || '')) {
      return cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed.'));
    }
    cb(null, true);
  },
});

// ----- shared helpers ---------------------------------------------------

function enrichQuote(q) {
  if (!q) return null;
  const lines = paintVolume.listEstimates(q.id);
  // Customer space photos. Defensive try/catch so a quote still serves even
  // if the quote_photos migration hasn't run yet.
  let photos = [];
  try {
    photos = db.prepare(`
      SELECT id, original_name, mime_type, size_bytes, caption, uploaded_at
        FROM quote_photos WHERE quote_id = ? ORDER BY id
    `).all(q.id).map(p => ({ ...p, url: `/api/quotes/${q.id}/photos/${p.id}` }));
  } catch (_) { photos = []; }
  return { ...q, paint_lines: lines, photos };
}

function ensureUniqueId() {
  // ID collision is astronomically unlikely (8 chars from a 32-char alphabet)
  // but cheap to defend against. Retry until we find a free one.
  let id = ids.quoteId();
  while (db.prepare('SELECT 1 FROM quotes WHERE id = ?').get(id)) id = ids.quoteId();
  return id;
}

// Server-decided day-rate. CRITICAL: the day-rate that goes into a quote total
// is decided by the server, never by the request body. Otherwise an anonymous
// customer could submit their own (low) rate and pay that on the booking that
// locks the quote price. If a painter is assigned, use that painter's profile
// rate; otherwise use the operator's default rate from the rate card.
function resolveRatePerDay(painter_id, rates) {
  if (painter_id != null) {
    const p = db.prepare('SELECT rate_per_day FROM painter_profiles WHERE id = ?').get(painter_id);
    if (!p) throw notFound(`Painter ${painter_id} not found.`);
    return p.rate_per_day;
  }
  return rates.defaultRatePerDay;
}

// Duration in painter-days derived from area when the caller doesn't supply
// one (the quote-preview path). One painter covers ~50 m²/day; clamp 1..60.
// booking.html derives the same value client-side (pmEstimateDurationDays) so
// the preview a customer sees and the quote that gets created agree.
function deriveDurationDays(areaSqm) {
  const d = Math.max(C.MIN_DURATION_DAYS, Math.ceil(Number(areaSqm) / 50));
  return Math.min(C.MAX_DURATION_DAYS, d);
}

// ----- GET /api/quotes/rates -------------------------------------------
//
// Public, read-only snapshot of the pricing inputs the quote page needs to
// compute a local estimate when it can't reach the preview endpoint (offline /
// file:// preview). Returns only the customer-facing numbers — the painter
// payout split is internal and intentionally omitted. The authoritative price
// always comes from /preview or quote-create; this is a graceful fallback.
router.get('/rates', asyncHandler(async (req, res) => {
  const rc = rateCard.getRateCard();
  res.json({
    success: true,
    rates: {
      ratePerSqm:        rc.ratePerSqm,
      materialsPerSqm:   rc.materialsPerSqm,
      defaultRatePerDay: rc.defaultRatePerDay,
      platformFeePct:    rc.platformFeePct,
      vatPct:            rc.vatPct,
    },
  });
}));

// ----- POST /api/quotes/preview ----------------------------------------
//
// Non-persisting price preview. The quote page calls this (debounced) so the
// number a customer sees is produced by the SAME canonical engine + rate card
// that will charge them — no client-side pricing model to drift. Anonymous
// (no auth) by design, same as quote create. Nothing is written to the DB.
router.post('/preview', [
  body('service').notEmpty(),
  body('area_sqm').isFloat({ min: C.MIN_AREA_SQM, max: C.MAX_AREA_SQM }),
  body('duration_days').optional().isInt({ min: C.MIN_DURATION_DAYS, max: C.MAX_DURATION_DAYS }),
  body('materials_included').optional().isBoolean(),
  body('painter_id').optional().isInt(),
], validate, asyncHandler(async (req, res) => {
  const { service, area_sqm, materials_included = true, painter_id = null } = req.body;
  const rates = rateCard.getRateCard();
  const duration_days = req.body.duration_days != null
    ? Number(req.body.duration_days)
    : deriveDurationDays(area_sqm);
  const rate_per_day = resolveRatePerDay(painter_id, rates);

  const calc = calculateQuote(
    { service, area_sqm, duration_days, rate_per_day, materials_included },
    rates,
  );
  res.json({ success: true, pricing: calc.breakdown, inputs: calc.inputs });
}));

// ----- POST /api/quotes -------------------------------------------------
//
// Anonymous quotes are allowed (customer_id stays NULL). If the caller
// supplies `paintLines`, each is persisted via services/paintVolume so the
// quote enters 'pending_review' atomically. If the array is omitted or empty,
// the quote stays at the default 'pending_review' state set by migration 025
// — meaning every quote requires a dispatcher to confirm before finalize.
// Quote callers that DO want to skip the gate (e.g. an admin one-off) can
// pass `volume_required: false`, which switches to 'not_required'.
//
router.post('/', [
  body('service').notEmpty(),
  body('area_sqm').isFloat({ min: C.MIN_AREA_SQM, max: C.MAX_AREA_SQM }),
  body('duration_days').isInt({ min: C.MIN_DURATION_DAYS, max: C.MAX_DURATION_DAYS }),
  // rate_per_day is now SERVER-DETERMINED — see below. We keep the optional
  // validator so a stray field doesn't trip validate, but the value is
  // ignored when computing the quote.
  body('rate_per_day').optional().isFloat({ min: C.MIN_RATE_PER_DAY, max: C.MAX_RATE_PER_DAY }),
  body('materials_included').optional().isBoolean(),
  body('painter_id').optional().isInt(),
  body('city').optional().isString().isLength({ max: 120 }),
  body('address').optional().isString().isLength({ max: 500 }),
  body('notes').optional().isString().isLength({ max: 1000 }),
  body('paintLines').optional().isArray(),
  body('volume_required').optional().isBoolean(),
], validate, asyncHandler(async (req, res) => {
  const {
    service, area_sqm, duration_days,
    materials_included = true,   // always-on: the platform supplies materials on every job
    painter_id = null, city = null, address = null, notes = null,
    paintLines = [],
    volume_required = true,
  } = req.body;

  // The day-rate is server-decided (see resolveRatePerDay) and the quote is
  // computed from the operator-owned rate card — the same engine the preview
  // endpoint uses, so the price a customer saw is the price they're charged.
  const rates = rateCard.getRateCard();
  const rate_per_day = resolveRatePerDay(painter_id, rates);

  const calc = calculateQuote({
    service, area_sqm, duration_days, rate_per_day,
    materials_included,
  }, rates);

  const id        = ensureUniqueId();
  const expires   = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  const customer  = req.user && req.user.role === 'customer' ? req.user.id : null;
  const initialVolumeStatus = volume_required ? 'pending_review' : 'not_required';

  // Atomic: insert the quote, then attach any provided paint lines. We use
  // a transaction so a half-persisted quote can never be left behind.
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO quotes
        (id, customer_id, painter_id, service, area_sqm, duration_days,
         materials_included, city, address, notes,
         labour, subtotal, platform_fee, total, pricing_breakdown, expires_at, volume_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, customer, painter_id, service, area_sqm, duration_days,
      materials_included ? 1 : 0, city, address, notes,
      calc.labour, calc.subtotal, calc.platform_fee, calc.total,
      JSON.stringify(calc.breakdown), expires, initialVolumeStatus,
    );

    const persistedLines = [];
    for (const line of paintLines) {
      if (!line || !line.paint_product_id || !line.area_sqm) continue;
      const rec = paintVolume.recordEstimate({
        quote_id: id,
        paint_product_id: line.paint_product_id,
        surface_area_sqm: line.area_sqm,
        coats: line.coats,
        notes: line.notes || null,
        created_by: customer,
      });
      persistedLines.push(rec);
    }
    return persistedLines;
  });
  const persistedLines = tx();

  const saved = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);
  res.status(201).json({
    success: true,
    message: persistedLines.length
      ? `Quote ${id} created. ${persistedLines.length} paint line(s) queued for dispatcher review.`
      : `Quote ${id} created.`,
    quote: enrichQuote(saved),
    pricing: calc.breakdown,
    persisted_paint_lines: persistedLines.length,
  });
}));

// ----- GET /api/quotes --------------------------------------------------
router.get('/', protect, asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(C.MAX_PAGE_SIZE, parseInt(req.query.limit || String(C.DEFAULT_PAGE_SIZE), 10));
  const offset = (page - 1) * limit;

  const where  = [];
  const params = [];
  if (req.user.role === 'customer') {
    where.push('customer_id = ?');
    params.push(req.user.id);
  }
  if (req.query.volume_status) {
    where.push('volume_status = ?');
    params.push(req.query.volume_status);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM quotes ${whereSql}`).get(...params).n;
  const rows  = db.prepare(`
    SELECT * FROM quotes ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    success: true,
    total, page, pages: Math.ceil(total / limit),
    quotes: rows.map(enrichQuote),
  });
}));

// ----- GET /api/quotes/:id ----------------------------------------------
router.get('/:id', protect, [ param('id').isString().notEmpty() ], validate,
  asyncHandler(async (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) throw notFound(`Quote ${req.params.id} not found.`);
    if (req.user.role !== 'admin' && quote.customer_id !== req.user.id) {
      // Anonymous quotes (customer_id=null) are visible to any authenticated
      // user who has the ID, by design — the URL acts as a bearer token for
      // the quote until it's claimed.
      if (quote.customer_id !== null) throw forbidden('Access denied.');
    }
    res.json({ success: true, quote: enrichQuote(quote) });
  })
);

// ----- PUT /api/quotes/:id/finalize ------------------------------------
//
// The gate. Throws 400 if volume hasn't been confirmed. Once finalized we
// stamp converted_booking_id later when the booking is actually created —
// for now this endpoint just asserts the quote is ready to convert.
router.put('/:id/finalize', protect, restrictTo('admin'),
  [ param('id').isString().notEmpty() ], validate,
  asyncHandler(async (req, res) => {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) throw notFound(`Quote ${req.params.id} not found.`);
    if (quote.converted_booking_id) {
      throw badRequest(`Quote already converted to booking ${quote.converted_booking_id}.`);
    }
    paintVolume.assertVolumeConfirmed(req.params.id);   // <-- the gate

    // We don't set converted_booking_id here — that happens when bookings.js
    // creates the booking and links back. The success response just confirms
    // the gate has cleared.
    res.json({
      success: true,
      message: `Quote ${req.params.id} is ready to convert into a booking.`,
      quote: enrichQuote(quote),
    });
  })
);

// ----- POST /api/quotes/:id/photos -------------------------------------
//
// Multipart upload of customer space photos for a quote. Field name: `photos`
// (up to 8 images). No auth required — consistent with anonymous quotes, where
// the hard-to-guess quote id acts as the bearer token. The dispatcher and the
// assigned painter see these on their review / job screens.
// Hard cap on photos attached to a single quote — anyone with the quote id
// can upload, so without a ceiling an attacker could fill disk one quote at
// a time. 8 mirrors the per-request multer cap.
const MAX_PHOTOS_PER_QUOTE = 8;

router.post('/:id/photos',
  [ param('id').isString().notEmpty() ],
  photoUpload.array('photos', 8),
  asyncHandler(async (req, res) => {
    const files = req.files || [];
    const cleanup = () => files.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) {} });

    const quote = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) {
      cleanup();
      throw notFound(`Quote ${req.params.id} not found.`);
    }
    if (!files.length) throw badRequest('No photos uploaded.');

    // Reject before persisting if this batch would push the quote over the
    // cap. We count what's already stored and compare against existing +
    // incoming. Files multer already wrote get cleaned up.
    const existing = db.prepare('SELECT COUNT(*) AS n FROM quote_photos WHERE quote_id = ?').get(quote.id).n;
    if (existing + files.length > MAX_PHOTOS_PER_QUOTE) {
      cleanup();
      throw badRequest(
        `This quote already has ${existing} photo${existing === 1 ? '' : 's'}; `
        + `the limit is ${MAX_PHOTOS_PER_QUOTE}.`
      );
    }

    const caption = (req.body.caption || '').toString().slice(0, 280);
    const uploadsRoot = path.resolve(process.cwd(), config.uploads.localDir || './uploads');
    const insert = db.prepare(`
      INSERT INTO quote_photos
        (quote_id, filename, original_name, mime_type, size_bytes, storage_path, caption)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const saved = [];
    for (const f of files) {
      // Store the path relative to the uploads root so a future cloud-storage
      // swap doesn't require rewriting historical rows.
      const relPath = path.relative(uploadsRoot, f.path);
      const r = insert.run(quote.id, f.filename, f.originalname, f.mimetype,
                           f.size, relPath, caption || null);
      saved.push({
        id: Number(r.lastInsertRowid),
        url: `/api/quotes/${quote.id}/photos/${r.lastInsertRowid}`,
        original_name: f.originalname,
      });
    }

    res.status(201).json({ success: true, count: saved.length, photos: saved });
  })
);

// ----- GET /api/quotes/:id/photos/:photoId -----------------------------
//
// Serves a quote photo. Gated by knowing both the quote id and the photo id —
// the same bearer-token model as GET /api/quotes/:id.
router.get('/:id/photos/:photoId',
  [ param('id').isString().notEmpty(), param('photoId').isInt() ], validate,
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM quote_photos WHERE id = ? AND quote_id = ?')
      .get(req.params.photoId, req.params.id);
    if (!row) throw notFound('Photo not found.');

    const abs = path.resolve(
      process.cwd(), config.uploads.localDir || './uploads', row.storage_path
    );
    if (!fs.existsSync(abs)) throw notFound('File missing on disk.');
    res.set('Cache-Control', 'private, max-age=300');
    res.set('Content-Type', row.mime_type);
    fs.createReadStream(abs).pipe(res);
  })
);

module.exports = router;
