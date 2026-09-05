import { Router } from 'express';
import { db } from '../db/index.js';
import { h, HttpError } from '../util.js';

const router = Router();

router.get('/', h((req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    rows = db
      .prepare('SELECT * FROM stops WHERE name LIKE ? ORDER BY name')
      .all(`%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM stops ORDER BY name').all();
  }
  res.json(rows);
}));

router.get('/:id', h((req, res) => {
  const stop = db.prepare('SELECT * FROM stops WHERE id = ?').get(req.params.id);
  if (!stop) throw new HttpError(404, 'Stop not found');
  const zones = db
    .prepare(
      `SELECT z.id, z.name FROM zones z
       JOIN stop_zones sz ON sz.zone_id = z.id
       WHERE sz.stop_id = ?`
    )
    .all(req.params.id);
  const routes = db
    .prepare(
      `SELECT DISTINCT r.id, r.short_name, r.long_name, r.mode
       FROM route_stops rs JOIN routes r ON r.id = rs.route_id
       WHERE rs.stop_id = ?`
    )
    .all(req.params.id);
  res.json({ ...stop, zones, routes });
}));

router.post('/', h((req, res) => {
  const { name, mode, lat, lon, zoneIds } = req.body;
  if (!name || !mode || lat == null || lon == null) throw new HttpError(400, 'name, mode, lat, lon are required');
  const info = db.prepare('INSERT INTO stops (name, mode, lat, lon) VALUES (?, ?, ?, ?)').run(name, mode, lat, lon);
  for (const zoneId of zoneIds || []) {
    db.prepare('INSERT INTO stop_zones (stop_id, zone_id) VALUES (?, ?)').run(info.lastInsertRowid, zoneId);
  }
  res.status(201).json(db.prepare('SELECT * FROM stops WHERE id = ?').get(info.lastInsertRowid));
}));

router.get('/meta/zones', h((req, res) => {
  res.json(db.prepare('SELECT * FROM zones ORDER BY id').all());
}));

export default router;
