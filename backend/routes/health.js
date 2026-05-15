// ============================
// Health checks. Mounted at root in server.js (NOT under /api) so load balancers
// can probe without going through rate limiting.
// ============================

const express = require('express');
const db      = require('../db');
const router  = express.Router();

router.get('/healthz', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

router.get('/readyz', (_req, res) => {
  // Verify the DB is responsive.
  try {
    db.prepare('SELECT 1 AS ok').get();
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    res.status(503).json({ ok: false, db: 'down', error: e.message });
  }
});

module.exports = router;
