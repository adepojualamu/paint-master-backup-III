// ============================
// routes/milestones.js — placeholder.
//
// Stubbed out so routes/index.js can require it without crashing the server.
// Real implementation will own: job_milestones CRUD (the per-booking
// checklist a painter ticks through during a job), with QA sub-role
// guarding the sign-off endpoints.
// ============================

const express = require('express');
const router  = express.Router();

router.all('*', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Milestones API not yet implemented.',
    method: req.method,
    path: req.originalUrl,
  });
});

module.exports = router;
