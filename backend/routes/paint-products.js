// ============================
// routes/paint-products.js — paint catalog CRUD.
//
// Owned by the inventory_manager sub-role. Surfaces the same paint_products
// rows that services/paintVolume reads at quote time, but lets the inventory
// team adjust coverage rates, prices, bucket sizes, and the active flag.
//
// Read endpoints are open (no auth) so the public preview calculator on
// paints.html and the customer-side quote builder can populate the dropdown
// without a login. Write endpoints require admin + inventory_manager (or
// super_admin, which the requireSubRole helper auto-allows).
// ============================

const express = require('express');
const { body, param } = require('express-validator');

const db            = require('../db');
const validate      = require('../middleware/validate');
const asyncHandler  = require('../middleware/asyncHandler');
const { protect, restrictTo, requireSubRole } = require('../middleware/auth');
const { notFound, badRequest } = require('../utils/errors');

const router = express.Router();

const SELECT_COLS = `id, name, type, brand, finish, coverage_m2_per_litre,
                     coats_recommended, price_per_litre, bucket_size_litres,
                     notes, active, created_at, updated_at`;

// ----- reservations roll-up --------------------------------------------
//
// Inventory Manager view: per-product committed paint. Each row is one
// paint_product joined to a SUM of its 'reserved' rows in paint_reservations.
// Products with zero reservations still appear so the dashboard shows the
// full catalog with a 0 column.
//
// MUST be declared before '/:id' below, otherwise express treats
// 'reservations' as the :id parameter.
router.get('/reservations', asyncHandler(async (req, res) => {
  const rows = db.prepare(`
    SELECT pp.id, pp.name, pp.type, pp.bucket_size_litres,
           COALESCE(SUM(CASE WHEN pr.status = 'reserved' THEN pr.litres_reserved  END), 0) AS litres_reserved,
           COALESCE(SUM(CASE WHEN pr.status = 'reserved' THEN pr.buckets_reserved END), 0) AS buckets_reserved,
           COALESCE(SUM(CASE WHEN pr.status = 'reserved' THEN pr.cost_reserved    END), 0) AS cost_reserved,
           COALESCE(SUM(CASE WHEN pr.status = 'consumed' THEN pr.litres_reserved  END), 0) AS litres_consumed,
           COUNT(CASE WHEN pr.status = 'reserved' THEN 1 END) AS quotes_reserved
      FROM paint_products pp
      LEFT JOIN paint_reservations pr ON pr.paint_product_id = pp.id
     WHERE pp.active = 1
     GROUP BY pp.id
     ORDER BY litres_reserved DESC, pp.name
  `).all();
  res.json({ success: true, reservations: rows });
}));

// ----- list -------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const wantInactive = req.query.include_inactive === '1' || req.query.include_inactive === 'true';
  const where = [];
  const params = [];
  if (!wantInactive) { where.push('active = 1'); }
  if (req.query.type) { where.push('type = ?'); params.push(req.query.type); }

  const sql = `
    SELECT ${SELECT_COLS} FROM paint_products
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY type, name
  `;
  const products = db.prepare(sql).all(...params);
  res.json({ success: true, products });
}));

// ----- read one ---------------------------------------------------------
router.get('/:id', [ param('id').isInt() ], validate,
  asyncHandler(async (req, res) => {
    const product = db.prepare(`SELECT ${SELECT_COLS} FROM paint_products WHERE id = ?`).get(req.params.id);
    if (!product) throw notFound(`paint_product ${req.params.id} not found`);
    res.json({ success: true, product });
  })
);

// ----- create -----------------------------------------------------------
const writeFields = [
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('type').isString().trim().isLength({ min: 2, max: 60 }),
  body('brand').optional().isString().trim().isLength({ max: 80 }),
  body('finish').optional().isString().trim().isLength({ max: 40 }),
  body('coverage_m2_per_litre').isFloat({ min: 0.1, max: 50 }),
  body('coats_recommended').isInt({ min: 1, max: 5 }),
  body('price_per_litre').isFloat({ min: 0, max: 100000 }),
  body('bucket_size_litres').isFloat({ min: 0.1, max: 1000 }),
  body('notes').optional().isString().isLength({ max: 500 }),
  body('active').optional().isBoolean(),
];

router.post('/', protect, restrictTo('admin'),
  requireSubRole('inventory_manager'),
  writeFields, validate,
  asyncHandler(async (req, res) => {
    const dup = db.prepare('SELECT id FROM paint_products WHERE name = ?').get(req.body.name);
    if (dup) throw badRequest(`A paint product named "${req.body.name}" already exists.`);
    const result = db.prepare(`
      INSERT INTO paint_products
        (name, type, brand, finish, coverage_m2_per_litre, coats_recommended,
         price_per_litre, bucket_size_litres, notes, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.body.name, req.body.type, req.body.brand || null, req.body.finish || null,
      req.body.coverage_m2_per_litre, req.body.coats_recommended,
      req.body.price_per_litre, req.body.bucket_size_litres,
      req.body.notes || null,
      req.body.active === false ? 0 : 1,
    );
    const product = db.prepare(`SELECT ${SELECT_COLS} FROM paint_products WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ success: true, product });
  })
);

// ----- update (full or partial — only writeable columns) ----------------
router.put('/:id', protect, restrictTo('admin'),
  requireSubRole('inventory_manager'),
  [ param('id').isInt() ],
  writeFields.map(v => v.optional()),    // every body field optional for PUT
  validate,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM paint_products WHERE id = ?').get(req.params.id);
    if (!existing) throw notFound(`paint_product ${req.params.id} not found`);

    const fields = ['name','type','brand','finish','coverage_m2_per_litre',
                    'coats_recommended','price_per_litre','bucket_size_litres','notes','active'];
    const sets = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] === undefined) continue;
      let v = req.body[f];
      if (f === 'active') v = v ? 1 : 0;
      sets.push(`${f} = ?`); params.push(v);
    }
    if (!sets.length) throw badRequest('No fields to update.');
    sets.push("updated_at = datetime('now')");
    params.push(req.params.id);

    db.prepare(`UPDATE paint_products SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    const product = db.prepare(`SELECT ${SELECT_COLS} FROM paint_products WHERE id = ?`).get(req.params.id);
    res.json({ success: true, product });
  })
);

// ----- soft-delete (toggle active=0) -----------------------------------
// We don't hard-delete because existing quote_volume_estimates rows reference
// this paint_product_id and we want their join to still resolve.
router.delete('/:id', protect, restrictTo('admin'),
  requireSubRole('inventory_manager'),
  [ param('id').isInt() ], validate,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT id, active FROM paint_products WHERE id = ?').get(req.params.id);
    if (!existing) throw notFound(`paint_product ${req.params.id} not found`);
    db.prepare("UPDATE paint_products SET active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: `paint_product ${req.params.id} deactivated.` });
  })
);

module.exports = router;
