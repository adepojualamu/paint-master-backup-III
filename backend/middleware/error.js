// ============================
// Global error handler. Translates AppError → status/code/details and falls back
// to 500 for anything unexpected. Stack trace is only sent to the client in dev.
// ============================

const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

// 404 handler — placed BEFORE the error handler in server.js.
function notFound(req, res) {
  res.status(404).json({ success: false, code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` });
}

function errorHandler(err, req, res, _next) {
  const status = err instanceof AppError ? err.status : (err.status || 500);
  const code   = err instanceof AppError ? err.code   : (err.code   || 'INTERNAL');

  // Log server errors loudly; ignore expected 4xx noise in production.
  if (status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, err.message);
  } else if (config.isDev) {
    logger.debug({ status, code, path: req.path }, err.message);
  }

  res.status(status).json({
    success: false,
    code,
    message: err.message || 'Something went wrong.',
    details: err.details,
    stack:   config.isDev && status >= 500 ? err.stack : undefined,
  });
}

module.exports = { notFound, errorHandler };
