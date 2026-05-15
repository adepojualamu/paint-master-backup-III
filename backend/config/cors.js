// ============================
// CORS policy.
// In production, only explicit origins listed in CORS_ORIGINS are allowed.
// In dev/test we allow all so static HTML can hit the API freely.
// ============================

const config = require('./index');

module.exports = function corsOptions() {
  if (!config.isProd || config.cors.origins.length === 0) {
    return { origin: true, credentials: true };
  }
  return {
    origin: (origin, callback) => {
      // Allow requests with no Origin header (curl, server-to-server).
      if (!origin) return callback(null, true);
      if (config.cors.origins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
  };
};
