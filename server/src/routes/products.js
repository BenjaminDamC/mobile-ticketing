import { Router } from 'express';
import { db } from '../db/index.js';
import { h, HttpError } from '../util.js';

const router = Router();

function currentPrices(productId) {
  return db
    .prepare(
      `SELECT fp.*, fz.name AS from_zone_name, tz.name AS to_zone_name
       FROM fare_prices fp
       LEFT JOIN zones fz ON fz.id = fp.from_zone_id
       LEFT JOIN zones tz ON tz.id = fp.to_zone_id
       WHERE fp.product_id = ? AND fp.valid_to IS NULL
       ORDER BY fp.from_zone_id, fp.to_zone_id`
    )
    .all(productId);
}

router.get('/', h((req, res) => {
  const products = db.prepare('SELECT * FROM fare_products ORDER BY id').all();
  res.json(products.map((p) => ({ ...p, prices: currentPrices(p.id) })));
}));

router.get('/:id', h((req, res) => {
  const product = db.prepare('SELECT * FROM fare_products WHERE id = ?').get(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  res.json({ ...product, prices: currentPrices(req.params.id) });
}));

router.post('/', h((req, res) => {
  const { name, description, validityMinutes, kind } = req.body;
  if (!name || !validityMinutes || !kind) throw new HttpError(400, 'name, validityMinutes, kind are required');
  const info = db
    .prepare(
      'INSERT INTO fare_products (name, description, validity_minutes, kind, active) VALUES (?, ?, ?, ?, 1)'
    )
    .run(name, description || null, validityMinutes, kind);
  res.status(201).json(db.prepare('SELECT * FROM fare_products WHERE id = ?').get(info.lastInsertRowid));
}));

router.patch('/:id', h((req, res) => {
  const product = db.prepare('SELECT * FROM fare_products WHERE id = ?').get(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  const { name, description, active } = req.body;
  db.prepare('UPDATE fare_products SET name = COALESCE(?, name), description = COALESCE(?, description), active = COALESCE(?, active) WHERE id = ?')
    .run(name ?? null, description ?? null, active === undefined ? null : (active ? 1 : 0), req.params.id);
  res.json(db.prepare('SELECT * FROM fare_products WHERE id = ?').get(req.params.id));
}));

// Set a new price, closing out whatever was previously in effect for this (product, zone pair).
router.post('/:id/prices', h((req, res) => {
  const product = db.prepare('SELECT * FROM fare_products WHERE id = ?').get(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  const { fromZoneId, toZoneId, priceCents, currency } = req.body;
  if (!priceCents) throw new HttpError(400, 'priceCents is required');

  const tx = db.transaction(() => {
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE fare_prices SET valid_to = ?
       WHERE product_id = ? AND valid_to IS NULL
         AND from_zone_id IS ? AND to_zone_id IS ?`
    ).run(now, req.params.id, fromZoneId ?? null, toZoneId ?? null);

    const info = db
      .prepare(
        `INSERT INTO fare_prices (product_id, from_zone_id, to_zone_id, price_cents, currency, valid_from)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(req.params.id, fromZoneId ?? null, toZoneId ?? null, priceCents, currency || 'EUR', now);
    return info.lastInsertRowid;
  });

  const priceId = tx();
  res.status(201).json(db.prepare('SELECT * FROM fare_prices WHERE id = ?').get(priceId));
}));

router.get('/:id/prices/history', h((req, res) => {
  res.json(
    db
      .prepare('SELECT * FROM fare_prices WHERE product_id = ? ORDER BY valid_from DESC')
      .all(req.params.id)
  );
}));

export default router;
