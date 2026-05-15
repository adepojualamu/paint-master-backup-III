// ============================
// routes/admin.js — admin aggregator.
//
// Mounted at /api/admin from routes/index.js. Re-exports the admin
// sub-routers that already exist (admin-users.js) and stubs the rest so
// the server boots cleanly. Add more sub-routes here as they get built
// (admin-quotes, admin-payouts, admin-analytics, etc.).
// ============================

const express = require('express');
const router  = express.Router();

// Existing admin sub-routers.
router.use('/users', require('./admin-users'));

// Future home for analytics, payouts, audit-log views. Stubbed for now
// so any premature client call returns a clean 501 instead of a 404.
router.all('*', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Admin endpoint not yet implemented.',
    method: req.method,
    path: req.originalUrl,
  });
});

module.exports = router;
