// ============================
// PaintGH — Main Server Entry Point
// ============================

require('dotenv').config();
const express     = require('express');
const path        = require('path');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');

const config = require('./config');
const app  = express();
const PORT = process.env.PORT || 3000;

// ===== TRUST PROXY =====
// We expect production deploys to sit behind a TLS-terminating reverse proxy
// (nginx / Render / Caddy). Trusting one hop lets Express read the original
// client IP from X-Forwarded-For (so express-rate-limit keys per real
// client, not per proxy) and the original scheme from X-Forwarded-Proto (so
// the HTTPS check below sees `req.secure === true` even though the inbound
// connection to Node is plaintext).
app.set('trust proxy', 1);

// ===== HTTPS ENFORCEMENT (production only) =====
// HSTS already tells browsers to upgrade, but it only takes effect AFTER a
// successful HTTPS visit. A brand-new client, a misconfigured cron, or a
// curl pipe can still hit plaintext http://. We close that window here:
//   - GET / HEAD get a permanent redirect to https:// (safe to bounce).
//   - Anything that might carry a credential or body gets a 403 — we never
//     accept a Bearer token, password, or payment payload over cleartext.
// Dev / test keep the plaintext path so local testing isn't broken.
if (config.isProd) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
    }
    return res.status(403).json({
      success: false,
      message: 'HTTPS is required. Retry with https://.',
    });
  });
}

// ===== SECURITY HEADERS =====
// Helmet sets a sensible default of HTTP security headers, plus a
// transitional Content-Security-Policy. The customer + admin pages still
// carry heavy inline <style> and <script> blocks, so 'unsafe-inline' stays
// while those move to external files; the rest of the policy is meaningful
// — external scripts can only load from the same origin, so a reflected /
// stored XSS that injects <script src="https://evil.example/x.js"> still
// gets blocked at the browser. Google Fonts are explicitly allow-listed.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src':  ["'self'"],
      'script-src':   ["'self'", "'unsafe-inline'"],
      // Helmet's useDefaults ships `script-src-attr 'none'`, which blocks
      // inline event-handler attributes (onclick=, oninput=, …) even when
      // script-src allows 'unsafe-inline'. Our pages wire buttons with inline
      // onclick handlers (e.g. the quote wizard's Next/Back), so without this
      // the browser silently refuses every one of them and the buttons feel
      // dead. Allow inline handlers for now; drop this alongside the inline-JS
      // cleanup that removes 'unsafe-inline' above.
      'script-src-attr': ["'unsafe-inline'"],
      'style-src':    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src':     ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'img-src':      ["'self'", 'data:', 'blob:'],
      'connect-src':  ["'self'"],
      'object-src':   ["'none'"],
      'base-uri':     ["'self'"],
      'frame-ancestors': ["'self'"],
    },
  },
  // Strict-Transport-Security: 1 year + subdomains + preload-eligible. The
  // browser only honours HSTS over HTTPS, so this is a no-op in dev (HTTP);
  // in production behind a TLS-terminating proxy it pins clients to HTTPS
  // and qualifies the host for the HSTS preload list.
  strictTransportSecurity: {
    maxAge:            31536000,   // 1 year, in seconds
    includeSubDomains: true,
    preload:           true,
  },
}));

// ===== CORS =====
// Production honours the CORS_ORIGINS allowlist defined in config/cors.js.
// Dev / test deliberately allow all so the static HTML can call the API.
const corsOptions = require('./config/cors')();
app.use(cors(corsOptions));

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

// Auto-seed an empty database on first boot so a fresh install (and the
// Docker container in particular) lands with a working admin + painter
// roster. The seed itself is idempotent: it short-circuits when users
// already exist, so subsequent boots are no-ops.
try {
  const seed = require('./db/seed');
  const result = seed();
  if (result && result.seeded) {
    console.log(`[seed] inserted ${result.painters} painters + ${result.others} other accounts`);
  }
} catch (err) {
  console.error('[seed] FAILED:', err.message);
  console.error('Server will continue; sign-in will only work for accounts created later.');
}

const authRouter     = require('./routes/auth');
const paintersRouter = require('./routes/painters');
const bookingsRouter = require('./routes/bookings');
const reviewsRouter  = require('./routes/reviews');
const paymentsRouter = require('./routes/payments');
const uploadsRouter    = require('./routes/uploads');
const adminUsersRouter = require('./routes/admin-users');
const adminPricingRouter = require('./routes/admin-pricing');
const quotesRouter        = require('./routes/quotes');
const paintVolumeRouter   = require('./routes/paint-volume');
const paintProductsRouter = require('./routes/paint-products');
const financeRouter       = require('./routes/finance');

app.use('/api/auth',     authRouter);
app.use('/api/painters', paintersRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/reviews',  reviewsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/uploads',  uploadsRouter);
app.use('/api/admin/uploads', uploadsRouter);  // share the same router; the moderation paths are under /admin/* inside the file
app.use('/api/admin/users',   adminUsersRouter);
app.use('/api/admin/pricing', adminPricingRouter);
app.use('/api/quotes',         quotesRouter);
app.use('/api/paint-volume',   paintVolumeRouter);
app.use('/api/paint-products', paintProductsRouter);
app.use('/api/finance',        financeRouter);

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

// ===== NOTIFICATION OUTBOX WORKER =====
// Drains notifications_outbox in the background — every route handler
// just calls notifications.emit() and the worker handles the actual
// Hubtel/Resend dispatch. Starts here (not on import) so tests that
// require server.js without listening don't get a stray timer.
const notifyWorker = require('./services/notifyWorker');

// ===== AUTO-ASSIGNMENT SWEEP =====
// Bookings are auto-proposed a painter at creation time, but if nobody was free
// then they stay in the manual queue. This background sweep retries them
// periodically (e.g. once a painter finishes a job and frees up), proposing a
// painter for a dispatcher to approve. Same lifecycle as the notify worker.
const autoAssign = require('./services/autoAssign');

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
  // Boot the background workers only when the server is actually serving.
  notifyWorker.start();
  autoAssign.start();
}