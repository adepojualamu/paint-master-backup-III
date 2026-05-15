// ============================
// scripts/reset-db.js
// Cross-platform DB reset: deletes the SQLite file, re-runs migrations,
// and re-seeds demo data. Safe to run on Windows + Mac + Linux.
//
// Usage:  node scripts/reset-db.js
// ============================

const fs     = require('fs');
const path   = require('path');
const config = require('../config');

const dbPath = path.resolve(config.db.path);
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';

console.log(`Resetting database at: ${dbPath}`);

// Kill the SQLite file + its WAL companion files if they exist.
[dbPath, walPath, shmPath].forEach(p => {
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`  removed ${path.basename(p)}`);
  }
});

// Now require the migrate + seed modules (they will create a fresh DB).
const { runAll } = require('../db/migrate');
const seed = require('../db/seed');

const result = runAll();
console.log(`Applied ${result.applied.length} migration(s).`);

const seedResult = seed();
console.log(`Seed: ${JSON.stringify(seedResult)}`);

console.log('Database reset complete.');
