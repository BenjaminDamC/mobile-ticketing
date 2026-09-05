import { Router } from 'express';
import { db } from '../db/index.js';
import { h, HttpError } from '../util.js';

const router = Router();

// ---- Operators ----
router.get('/operators', h((req, res) => {
  res.json(db.prepare('SELECT * FROM operators ORDER BY name').all());
}));

router.post('/operators', h((req, res) => {
  const { name, shortCode } = req.body;
  if (!name || !shortCode) throw new HttpError(400, 'name and shortCode are required');
  const info = db.prepare('INSERT INTO operators (name, short_code) VALUES (?, ?)').run(name, shortCode);
  res.status(201).json(db.prepare('SELECT * FROM operators WHERE id = ?').get(info.lastInsertRowid));
}));

// ---- Vehicles ----
router.get('/vehicles', h((req, res) => {
  const { operatorId } = req.query;
  const rows = operatorId
    ? db.prepare('SELECT * FROM vehicles WHERE operator_id = ? ORDER BY registration').all(operatorId)
    : db.prepare('SELECT * FROM vehicles ORDER BY registration').all();
  res.json(rows);
}));

router.post('/vehicles', h((req, res) => {
  const { operatorId, mode, registration, capacity } = req.body;
  if (!operatorId || !mode || !registration || !capacity) {
    throw new HttpError(400, 'operatorId, mode, registration, capacity are required');
  }
  const info = db
    .prepare('INSERT INTO vehicles (operator_id, mode, registration, capacity) VALUES (?, ?, ?, ?)')
    .run(operatorId, mode, registration, capacity);
  res.status(201).json(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(info.lastInsertRowid));
}));

// ---- Routes (network definition: line + stopping pattern) ----
router.get('/routes', h((req, res) => {
  const routes = db
    .prepare(
      `SELECT r.*, o.name AS operator_name FROM routes r
       JOIN operators o ON o.id = r.operator_id
       ORDER BY r.mode, r.short_name`
    )
    .all();
  res.json(routes);
}));

router.get('/routes/:id', h((req, res) => {
  const route = db
    .prepare(
      `SELECT r.*, o.name AS operator_name FROM routes r
       JOIN operators o ON o.id = r.operator_id
       WHERE r.id = ?`
    )
    .get(req.params.id);
  if (!route) throw new HttpError(404, 'Route not found');
  const stops = db
    .prepare(
      `SELECT rs.sequence, rs.offset_seconds, s.id AS stop_id, s.name, s.mode
       FROM route_stops rs JOIN stops s ON s.id = rs.stop_id
       WHERE rs.route_id = ? ORDER BY rs.sequence`
    )
    .all(req.params.id);
  res.json({ ...route, stops });
}));

router.post('/routes', h((req, res) => {
  const { operatorId, mode, shortName, longName, stops } = req.body;
  if (!operatorId || !mode || !shortName || !longName) {
    throw new HttpError(400, 'operatorId, mode, shortName, longName are required');
  }
  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO routes (operator_id, mode, short_name, long_name) VALUES (?, ?, ?, ?)')
      .run(operatorId, mode, shortName, longName);
    const routeId = info.lastInsertRowid;
    (stops || []).forEach((s, i) => {
      db.prepare(
        'INSERT INTO route_stops (route_id, stop_id, sequence, offset_seconds) VALUES (?, ?, ?, ?)'
      ).run(routeId, s.stopId, i + 1, s.offsetSeconds ?? 0);
    });
    return routeId;
  });
  const routeId = tx();
  res.status(201).json(db.prepare('SELECT * FROM routes WHERE id = ?').get(routeId));
}));

router.put('/routes/:id/stops', h((req, res) => {
  const { stops } = req.body; // full replacement of the stopping pattern
  if (!Array.isArray(stops)) throw new HttpError(400, 'stops array is required');
  const routeId = req.params.id;
  const route = db.prepare('SELECT id FROM routes WHERE id = ?').get(routeId);
  if (!route) throw new HttpError(404, 'Route not found');
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM route_stops WHERE route_id = ?').run(routeId);
    stops.forEach((s, i) => {
      db.prepare(
        'INSERT INTO route_stops (route_id, stop_id, sequence, offset_seconds) VALUES (?, ?, ?, ?)'
      ).run(routeId, s.stopId, i + 1, s.offsetSeconds ?? 0);
    });
  });
  tx();
  res.json({ ok: true });
}));

export default router;
