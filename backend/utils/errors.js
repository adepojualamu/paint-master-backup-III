// ============================
// Typed application errors. Throw these from routes/services and the global
// error handler will translate them to the right HTTP status.
// ============================

class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL', details } = {}) {
    super(message);
    this.name    = 'AppError';
    this.status  = status;
    this.code    = code;
    this.details = details;
  }
}

const make = (status, code) => (message, details) =>
  new AppError(message, { status, code, details });

module.exports = {
  AppError,
  badRequest:    make(400, 'BAD_REQUEST'),
  unauthorized:  make(401, 'UNAUTHORIZED'),
  forbidden:     make(403, 'FORBIDDEN'),
  notFound:      make(404, 'NOT_FOUND'),
  conflict:      make(409, 'CONFLICT'),
  unprocessable: make(422, 'UNPROCESSABLE'),
  rateLimited:   make(429, 'RATE_LIMITED'),
  serverError:   make(500, 'INTERNAL'),
};
