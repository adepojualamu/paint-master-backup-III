// ============================
// routes/contracts.js — placeholder.
//
// Stubbed out so routes/index.js can require it without crashing the server.
// Real implementation will own: contract generation from a finalized quote,
// e-signature lifecycle, and contract-state transitions.
// ============================

const express = require('express');
const router  = express.Router();

router.all('*', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Contracts API not yet implemented. See routes/quotes.js for the finalize gate.',
    method: req.method,
    path: req.originalUrl,
  });
});

module.exports = router;
