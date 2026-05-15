// ============================
// Database connection. Single shared better-sqlite3 instance.
// Migrations are run once at boot from server.js.
// ============================

const Database = require('better-sqlite3');
const path     = require('path');
const config   = require('../config');

const db = new Database(path.resolve(config.db.path));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');     // safe with WAL, faster than FULL

module.exports = db;
