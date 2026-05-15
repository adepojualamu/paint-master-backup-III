// ============================
// Express-validator helper. Run after a chain of body()/query()/param() validators
// and it will short-circuit with a 400 listing every failure.
// ============================

const { validationResult } = require('express-validator');

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    success: false,
    code:    'VALIDATION_FAILED',
    errors:  errors.array().map(e => ({ field: e.path, message: e.msg, value: e.value })),
  });
};
