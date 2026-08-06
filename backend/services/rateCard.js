// ============================
// services/rateCard.js — reads/writes the operator-editable pricing rate card.
//
// The rate card is the single source of truth for "what does a job cost?".
// Values live in the pricing_settings table (migration 031); the editable
// catalog + validation live in config/pricingSchema.js. This module is the
// thin layer the rest of the app uses:
//
//   getRateCard()       → structured { ratePerSqm, materialsPerSqm, ... }
//   getFlatSettings()   → raw key→value map (for the admin GET endpoint)
//   updateSettings(...) → validate + persist a batch of edits, bust the cache
//
// Reads are cached in-process because calculateQuote runs on every quote
// preview keystroke. The cache is invalidated on any write.
// ============================

const db     = require('../db');
const schema = require('../config/pricingSchema');

let _cache = null;   // structured rate card
let _flatCache = null;

function _loadFlat() {
  const flat = {};
  try {
    for (const row of db.prepare('SELECT key, value FROM pricing_settings').all()) {
      flat[row.key] = row.value;
    }
  } catch (_) {
    // Table missing (migrations not yet run) — fall back to schema defaults so
    // the engine still works rather than throwing on boot.
  }
  // Merge defaults underneath so a missing row never leaves a hole.
  return { ...schema.DEFAULTS, ...flat };
}

/** Structured rate card for the pricing engine. Cached. */
function getRateCard() {
  if (_cache) return _cache;
  _flatCache = _loadFlat();
  _cache = schema.toRateCard(_flatCache);
  return _cache;
}

/** Raw key→value map (defaults merged). Used by the admin read endpoint. */
function getFlatSettings() {
  if (!_flatCache) getRateCard();
  return { ..._flatCache };
}

/** Drop the cache so the next read reflects fresh DB state. */
function invalidate() { _cache = null; _flatCache = null; }

/**
 * Validate and persist a batch of edits.
 * @param {object} edits   key→value map (subset of schema keys)
 * @param {number|null} userId  admin who made the change (for updated_by)
 * @returns {{ ok: true, updated: string[] } | { ok: false, errors: string[] }}
 */
function updateSettings(edits, userId = null) {
  const keys = Object.keys(edits || {});
  if (keys.length === 0) return { ok: false, errors: ['No settings provided.'] };

  // Validate everything first — all-or-nothing, so a bad value never lands.
  const errors = [];
  const clean = {};
  for (const key of keys) {
    const r = schema.validateSetting(key, edits[key]);
    if (!r.ok) errors.push(r.error);
    else clean[key] = r.value;
  }
  if (errors.length) return { ok: false, errors };

  const upsert = db.prepare(`
    INSERT INTO pricing_settings (key, value, updated_at, updated_by)
    VALUES (?, ?, datetime('now'), ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `);
  const tx = db.transaction(() => {
    for (const key of Object.keys(clean)) upsert.run(key, clean[key], userId);
  });
  tx();
  invalidate();
  return { ok: true, updated: Object.keys(clean) };
}

module.exports = { getRateCard, getFlatSettings, updateSettings, invalidate };
