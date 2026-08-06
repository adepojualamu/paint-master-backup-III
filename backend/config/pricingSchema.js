// ============================
// config/pricingSchema.js — the editable catalog for the pricing rate card.
//
// The DB table `pricing_settings` (migration 031) holds the operator's chosen
// VALUES. This file is the schema around them: which keys are editable, how to
// label/group them in the admin UI, how to validate them, and what to fall
// back to if a row is ever missing. Keeping the schema in code (not the DB)
// means validation and the admin form are driven from one place and can never
// drift from what the engine understands.
//
// Every value is a REAL number. `type` tells the UI how to render/validate:
//   'rate'     — GHS per sqm
//   'currency' — GHS amount
//   'percent'  — a fraction in [0,1] shown to the operator as a percentage
// ============================

// The six service types the engine prices. Must match the keys the quote
// create/preview routes accept (and the legacy C.RATE_PER_SQM).
const SERVICES = ['Interior', 'Exterior', 'Commercial', 'Decorative', 'Waterproofing', 'Repaint'];

// Default per-service labour rate (GHS/sqm) — mirrors the seed in migration 031.
const SERVICE_RATE_DEFAULTS = {
  Interior: 14, Exterior: 18, Commercial: 22, Decorative: 35, Waterproofing: 28, Repaint: 12,
};

// Build the editable catalog. Each entry: { key, label, category, type, min, max, default, help }
const SETTINGS = [
  // Per-service labour rates.
  ...SERVICES.map(svc => ({
    key: `rate_per_sqm.${svc}`,
    label: `${svc} — labour rate`,
    category: 'service_rates',
    type: 'rate',
    min: 1,
    max: 1000,
    default: SERVICE_RATE_DEFAULTS[svc],
    help: `Painter labour, GHS per m², for ${svc} jobs.`,
  })),

  // Platform economics + materials.
  { key: 'materials_per_sqm',    label: 'Materials',          category: 'economics', type: 'rate',     min: 0,    max: 1000, default: 45,   help: 'Platform-supplied paint + primer, GHS per m².' },
  { key: 'default_rate_per_day', label: 'Default day-rate',   category: 'economics', type: 'currency', min: 50,   max: 5000, default: 500,  help: 'GHS per day used for quotes with no painter assigned yet.' },
  { key: 'platform_fee_pct',     label: 'Platform fee',       category: 'economics', type: 'percent',  min: 0,    max: 0.5,  default: 0.10, help: 'Fee added on top of labour. 0.10 = 10%.' },
  { key: 'painter_payout_pct',   label: 'Painter payout',     category: 'economics', type: 'percent',  min: 0.5,  max: 1,    default: 0.90, help: "Painter's share of labour at QA-approve. 0.90 = 90%." },

  // Tax.
  { key: 'vat_pct',              label: 'VAT',                category: 'tax',       type: 'percent',  min: 0,    max: 0.5,  default: 0.125, help: 'Ghana VAT applied to the pre-tax total. 0.125 = 12.5%.' },
];

const BY_KEY = Object.fromEntries(SETTINGS.map(s => [s.key, s]));

// Defaults as a flat key→value map (used when a DB row is missing).
const DEFAULTS = Object.fromEntries(SETTINGS.map(s => [s.key, s.default]));

/**
 * Validate a single key/value against the schema.
 * Returns { ok: true, value } with the coerced number, or { ok: false, error }.
 */
function validateSetting(key, rawValue) {
  const spec = BY_KEY[key];
  if (!spec) return { ok: false, error: `Unknown pricing key: ${key}` };
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return { ok: false, error: `${key} must be a number` };
  if (value < spec.min || value > spec.max) {
    return { ok: false, error: `${key} must be between ${spec.min} and ${spec.max}` };
  }
  return { ok: true, value };
}

/**
 * Shape a flat key→value map into the structured rate card the engine uses.
 * Missing keys fall back to DEFAULTS so the engine always gets a complete card.
 */
function toRateCard(flat = {}) {
  const get = (k) => {
    const v = Number(flat[k]);
    return Number.isFinite(v) ? v : DEFAULTS[k];
  };
  const ratePerSqm = {};
  for (const svc of SERVICES) ratePerSqm[svc] = get(`rate_per_sqm.${svc}`);
  return {
    ratePerSqm,
    materialsPerSqm:   get('materials_per_sqm'),
    defaultRatePerDay: get('default_rate_per_day'),
    platformFeePct:    get('platform_fee_pct'),
    painterPayoutPct:  get('painter_payout_pct'),
    vatPct:            get('vat_pct'),
  };
}

module.exports = { SERVICES, SETTINGS, BY_KEY, DEFAULTS, validateSetting, toRateCard };
