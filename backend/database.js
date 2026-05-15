// ============================
// DEPRECATED — kept as a compatibility shim. New code should:
//   const db = require('./db');
// Schema lives in db/migrations/, seeding in db/seed.js, runner in db/migrate.js.
// ============================

// eslint-disable-next-line no-console
console.warn('[deprecation] require("./database") is deprecated; use require("./db") instead.');

module.exports = require('./db');
