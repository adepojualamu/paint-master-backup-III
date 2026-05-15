// ============================
// services/paintVolume.js — paint volume calculator.
//
// Pure-function math + thin DB helpers. The math takes a surface area, number
// of coats, and a paint_product (with coverage_m2_per_litre and bucket_size_litres)
// and returns litres + whole-bucket counts and a material cost estimate.
//
// This is the canonical answer to "how much paint do we need for this job?"
// Both the customer-facing quote form and the dispatcher review screen call
// this, so the number the customer sees and the number we order can never
// disagree.
// ============================

const db = require('../db');
const C  = require('../config/constants');
const { badRequest, notFound } = require('../utils/errors');

/**
 * Compute litres + buckets needed for a single product line.
 *
 * @param {object} input
 * @param {number} input.surface_area_sqm
 * @param {number} input.coats
 * @param {number} input.coverage_m2_per_litre   single-coat coverage of the product
 * @param {number} input.bucket_size_litres
 * @param {number} [input.price_per_litre]       GHS; if provided, cost_estimate is computed
 * @param {number} [input.waste_factor=0.10]     10% default waste/touch-ups overhead
 * @returns {object} { litres_needed, buckets_needed, cost_estimate, breakdown }
 */
function computeLine(input) {
  const area     = Number(input.surface_area_sqm);
  const coats    = Number(input.coats);
  const coverage = Number(input.coverage_m2_per_litre);
  const bucket   = Number(input.bucket_size_litres);
  const price    = Number(input.price_per_litre || 0);
  const waste    = input.waste_factor == null ? 0.10 : Number(input.waste_factor);

  if (!Number.isFinite(area)     || area     < C.MIN_AREA_SQM || area > C.MAX_AREA_SQM)
    throw badRequest(`surface_area_sqm must be between ${C.MIN_AREA_SQM} and ${C.MAX_AREA_SQM}`);
  if (!Number.isInteger(coats)   || coats    < 1 || coats > 5)
    throw badRequest('coats must be an integer between 1 and 5');
  if (!Number.isFinite(coverage) || coverage <= 0)
    throw badRequest('coverage_m2_per_litre must be > 0');
  if (!Number.isFinite(bucket)   || bucket   <= 0)
    throw badRequest('bucket_size_litres must be > 0');
  if (!(waste >= 0 && waste < 1))
    throw badRequest('waste_factor must be in [0, 1)');

  // raw_litres = (area × coats) / coverage. Multiply by (1 + waste) for touch-ups
  // and trim. Round up to whole buckets — you can't buy half a bucket.
  const rawLitres   = (area * coats) / coverage;
  const litres      = round2(rawLitres * (1 + waste));
  const buckets     = Math.ceil(litres / bucket);
  const cost        = round2(buckets * bucket * price);

  return {
    litres_needed:  litres,
    buckets_needed: buckets,
    cost_estimate:  cost,
    breakdown: {
      surface_area_sqm:      area,
      coats,
      coverage_m2_per_litre: coverage,
      bucket_size_litres:    bucket,
      waste_factor:          waste,
      raw_litres:            round2(rawLitres),
      with_waste_litres:     litres,
    },
  };
}

/**
 * Compute a line by looking up the paint product from the catalog.
 * Returns the computed result PLUS the product snapshot fields we'll persist.
 */
function estimateForProduct({ paint_product_id, surface_area_sqm, coats }) {
  const product = db.prepare(
    'SELECT id, name, type, coverage_m2_per_litre, coats_recommended, price_per_litre, bucket_size_litres, active FROM paint_products WHERE id = ?'
  ).get(paint_product_id);
  if (!product) throw notFound(`paint_product ${paint_product_id} not found`);
  if (!product.active) throw badRequest(`paint_product ${product.name} is inactive`);

  const effectiveCoats = Number.isInteger(coats) && coats > 0 ? coats : product.coats_recommended;
  const line = computeLine({
    surface_area_sqm,
    coats: effectiveCoats,
    coverage_m2_per_litre: product.coverage_m2_per_litre,
    bucket_size_litres:    product.bucket_size_litres,
    price_per_litre:       product.price_per_litre,
  });

  return {
    product,
    coats: effectiveCoats,
    ...line,
  };
}

/**
 * Persist a volume estimate row tied to a quote. Flips the parent quote to
 * 'pending_review' if it isn't already past that state.
 */
function recordEstimate({ quote_id, paint_product_id, surface_area_sqm, coats, created_by, notes }) {
  const quote = db.prepare('SELECT id, volume_status FROM quotes WHERE id = ?').get(quote_id);
  if (!quote) throw notFound(`Quote ${quote_id} not found`);
  if (quote.volume_status === 'confirmed') {
    throw badRequest('Volume already confirmed for this quote — cannot add more lines.');
  }

  const est = estimateForProduct({ paint_product_id, surface_area_sqm, coats });

  const result = db.prepare(`
    INSERT INTO quote_volume_estimates
      (quote_id, paint_product_id, surface_area_sqm, coats, coverage_m2_per_litre,
       bucket_size_litres, litres_needed, buckets_needed, cost_estimate, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    quote_id,
    paint_product_id,
    est.breakdown.surface_area_sqm,
    est.coats,
    est.breakdown.coverage_m2_per_litre,
    est.breakdown.bucket_size_litres,
    est.litres_needed,
    est.buckets_needed,
    est.cost_estimate,
    notes || null,
    created_by || null,
  );

  // Move quote into pending_review if it was previously not_required.
  if (quote.volume_status !== 'pending_review') {
    db.prepare("UPDATE quotes SET volume_status = 'pending_review' WHERE id = ?").run(quote_id);
  }

  return {
    estimate_id: result.lastInsertRowid,
    quote_id,
    product:     est.product,
    coats:       est.coats,
    litres_needed:  est.litres_needed,
    buckets_needed: est.buckets_needed,
    cost_estimate:  est.cost_estimate,
    breakdown:      est.breakdown,
  };
}

/**
 * List all estimate lines for a quote with their product names attached.
 */
function listEstimates(quote_id) {
  return db.prepare(`
    SELECT qve.*, pp.name AS product_name, pp.type AS product_type
      FROM quote_volume_estimates qve
      JOIN paint_products pp ON pp.id = qve.paint_product_id
     WHERE qve.quote_id = ?
     ORDER BY qve.id
  `).all(quote_id);
}

/**
 * Dispatcher (or super_admin) confirms the volume for a quote — gate cleared.
 */
function confirm({ quote_id, user_id }) {
  const quote = db.prepare('SELECT id, volume_status FROM quotes WHERE id = ?').get(quote_id);
  if (!quote) throw notFound(`Quote ${quote_id} not found`);
  if (quote.volume_status === 'confirmed') {
    throw badRequest('Volume already confirmed.');
  }
  const lines = listEstimates(quote_id);
  if (lines.length === 0) {
    throw badRequest('Cannot confirm — no volume estimates have been entered for this quote.');
  }
  db.prepare(`
    UPDATE quotes SET volume_status = 'confirmed',
                      volume_confirmed_by = ?,
                      volume_confirmed_at = datetime('now')
     WHERE id = ?
  `).run(user_id, quote_id);
  return { quote_id, status: 'confirmed', lines };
}

function reject({ quote_id, user_id, reason }) {
  const quote = db.prepare('SELECT id, volume_status FROM quotes WHERE id = ?').get(quote_id);
  if (!quote) throw notFound(`Quote ${quote_id} not found`);
  db.prepare(`
    UPDATE quotes SET volume_status = 'rejected',
                      volume_confirmed_by = ?,
                      volume_confirmed_at = datetime('now')
     WHERE id = ?
  `).run(user_id, quote_id);
  return { quote_id, status: 'rejected', reason: reason || null };
}

/**
 * Gatekeeper used by the quote-finalize / contract-create paths. Throws if
 * the volume hasn't been confirmed. Call this before flipping a quote into a
 * contract.
 */
function assertVolumeConfirmed(quote_id) {
  const row = db.prepare('SELECT volume_status FROM quotes WHERE id = ?').get(quote_id);
  if (!row) throw notFound(`Quote ${quote_id} not found`);
  if (row.volume_status !== 'confirmed') {
    throw badRequest(
      `Quote ${quote_id} cannot be finalized — volume_status is '${row.volume_status}'. ` +
      `A dispatcher must confirm the paint volume estimate first.`
    );
  }
}

function round2(n) { return Math.round(n * 100) / 100; }

module.exports = {
  computeLine,
  estimateForProduct,
  recordEstimate,
  listEstimates,
  confirm,
  reject,
  assertVolumeConfirmed,
};
