// ============================
// Wraps async route handlers so unhandled rejections become next(err) calls.
// Usage:  router.get('/x', asyncHandler(async (req, res) => { ... }))
// ============================

module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
