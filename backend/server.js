// ============================
// PaintGH — Main Server Entry Point
// ============================

require('dotenv').config();
const express     = require('express');
const path        = require('path');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ===== SECURITY HEADERS =====
// Helmet sets a sensible default of HTTP security headers
// (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.)
//
// CSP is disabled here because the customer + admin pages use heavy inline
// <style> and <script> blocks. In production we'll move those to external
// files and re-enable a strict policy. For now, the rest of helmet's headers
// stay on; only content-security-policy is off.
app.use(helmet({ contentSecurityPolicy: false }));

// ===== CORS =====
// In production we'd lock this down to the customer + admin frontend origins.
// For now (development) we allow all so the static HTML can call the API.
app.use(cors());

// ===== BODY PARSERS =====
// 100kb cap is plenty for JSON booking payloads and prevents trivial abuse.
// The `verify` hook stashes the raw bytes onto req.rawBody so payment-callback
// routes can verify HMAC signatures against the exact payload Hubtel sent
// (the JSON parse re-orders keys / strips whitespace and would break the hash).
app.use(express.json({
  limit: '100kb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ===== REQUEST LOGGER =====
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ===== RATE LIMITERS =====
// Tighter limit on /auth — login endpoints are the brute-force target.
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min default
  max:      parseInt(process.env.RATE_LIMIT_AUTH_MAX  || '10',     10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many authentication attempts. Please try again in a few minutes.' },
});

// Looser global limiter — catches scrapers / runaway clients.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max:      120,       // 120 req/min/IP
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Apply general limiter to all /api routes; auth limiter mounts before /api/auth.
app.use('/api/auth', authLimiter);
app.use('/api',      apiLimiter);

// ===== ROUTES =====
// ===== DB MIGRATIONS =====
// Apply any pending SQL migrations before the routers wire up. Migrations are
// tracked in the _migrations table inside SQLite, so this is idempotent —
// every boot just runs whatever is new. Without this, a developer who pulls
// fresh migrations and restarts the server hits 500s on every route that
// touches the new tables/columns (paint_products, quotes.volume_status, etc.).
try {
  const { runAll } = require('./db/migrate');
  const result = runAll();
  if (result.applied && result.applied.length) {
    console.log(`[migrations] applied ${result.applied.length}: ${result.applied.join(', ')}`);
  }
} catch (err) {
  console.error('[migrations] FAILED:', err.message);
  console.error('Server will continue, but DB-backed routes may 500. Run `node db/migrate.js` manually.');
}

const authRouter     = require('./routes/auth');
const paintersRouter = require('./routes/painters');
const bookingsRouter = require('./routes/bookings');
const reviewsRouter  = require('./routes/reviews');
const paymentsRouter = require('./routes/payments');
const uploadsRouter    = require('./routes/uploads');
const adminUsersRouter = require('./routes/admin-users');
const quotesRouter      = require('./routes/quotes');
const paintVolumeRouter = require('./routes/paint-volume');
const paintProductsRouter = require('./routes/paint-products');

app.use('/api/auth',     authRouter);
app.use('/api/painters', paintersRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/reviews',  reviewsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/uploads',  uploadsRouter);
app.use('/api/admin/uploads', uploadsRouter);  // share the same router; the moderation paths are under /admin/* inside the file
app.use('/api/admin/users',   adminUsersRouter);
app.use('/api/quotes',         quotesRouter);
app.use('/api/paint-volume',   paintVolumeRouter);
app.use('/api/paint-products', paintProductsRouter);

// ===== API INFO =====
// Programmatic clients can hit /api for a list of endpoints. The browser
// homepage (/) is handled by the static middleware below, which serves the
// project's index.html.
app.get('/api', (_req, res) => {
  res.json({
    name:    'PaintGH API',
    version: '1.0.1',
    status:  'running',
    endpoints: {
      auth:     '/api/auth',
      painters: '/api/painters',
      bookings: '/api/bookings',
      reviews:  '/api/reviews',
      payments: '/api/payments'
    },
    docs: 'See README.md for full API reference'
  });
});

// ===== STATIC FRONTEND =====
// Serve the customer site + admin console straight out of the project root
// (one folder up from `backend/`). The `index: 'index.html'` setting makes
// `GET /` resolve to the customer homepage; admin pages live at /admin/*.
// Any path that doesn't match a file falls through to the 404 handler below.
app.use(express.static(path.join(__dirname, '..'), {
  index:      'index.html',
  extensions: ['html'],   // /login resolves to /login.html
  fallthrough: true,
}));

// ===== 404 HANDLER =====
// JSON for /api paths (programmatic clients), a friendly text fallback for
// anything else (a customer mistyped a URL).
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Route not found.' });
  }
  res.status(404).type('text/plain')
    .send(`Not found: ${req.method} ${req.path}\n\nGo back to /`);
});

// ===== GLOBAL ERROR HANDLER =====
// Translates AppError → proper status / code / details. The legacy inline
// handler hard-coded 500 for everything, which made every routes/* AppError
// (badRequest, notFound, forbidden, conflict, ...) surface as a 500.
const { errorHandler } = require('./middleware/error');
app.use(errorHandler);

// ===== START SERVER =====
// Only listen when run directly — lets tests import `app` without a port collision.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🎨 Paint Masters running at http://localhost:${PORT}`);
    console.log(`   Customer site: http://localhost:${PORT}/`);
    console.log(`   Admin console: http://localhost:${PORT}/admin/`);
    console.log(`   API root:      http://localhost:${PORT}/api`);
    console.log('');
  });
}