// ============================
// Migration runner. Applies every .sql file in db/migrations/ in lexical order
// exactly once. Tracks applied migrations in a `_migrations` table.
//
// Idempotent — safe to call on every boot.
// ============================

const fs   = require('fs');
const path = require('path');
const db   = require('./index');
const log  = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function ensureRegistry() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function appliedIds() {
  return new Set(db.prepare('SELECT id FROM _migrations').all().map(r => r.id));
}

function pendingMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  const all = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  const done = appliedIds();
  return all.filter(f => !done.has(f));
}

function runOne(file) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

  // Foreign-key enforcement must be toggled OUTSIDE the transaction: SQLite
  // treats `PRAGMA foreign_keys` as a no-op while a transaction is open, so a
  // migration that relies on `PRAGMA foreign_keys = OFF` (the standard 12-step
  // table-rebuild procedure, e.g. 026) would otherwise run with FKs still on
  // and fail on DROP TABLE with "FOREIGN KEY constraint failed". We disable
  // FKs here, run the migration in a transaction, then re-enable and verify
  // the rebuild left no dangling references.
  db.pragma('foreign_keys = OFF');
  try {
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(file);
    });
    tx();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  const violations = db.pragma('foreign_key_check');
  if (violations.length > 0) {
    throw new Error(
      `Migration ${file} left foreign-key violations: ${JSON.stringify(violations)}`
    );
  }

  log.info({ file }, 'Applied migration');
}

function runAll() {
  ensureRegistry();
  const pending = pendingMigrations();
  if (pending.length === 0) {
    log.debug('Migrations: nothing to apply.');
    return { applied: [] };
  }
  log.info(`Applying ${pending.length} migration(s)...`);
  for (const file of pending) runOne(file);
  return { applied: pending };
}

if (require.main === module) {
  const result = runAll();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { runAll, pendingMigrations };
