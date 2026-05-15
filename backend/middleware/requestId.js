// ============================
// Attaches a UUID to every request so logs across services can be correlated.
// Reads `X-Request-Id` from the inbound header if present, otherwise generates one.
// ============================

const { uuid } = require('../utils/ids');

module.exports = function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || uuid();
  res.setHeader('X-Request-Id', req.id);
  next();
};
