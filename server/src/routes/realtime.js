import { Router } from 'express';
import { db } from '../db/index.js';
import { h, HttpError } from '../util.js';

const router = Router();

router.post('/', h((req, res) => {
  const { tripId, stopId, delayMinutes, occupancy, source } = req.body;
  if (!tripId || !stopId || delayMinutes === undefined) {
    throw new HttpError(400, 'tripId, stopId, delayMinutes are required');
  }
  const trip = db.prepare('SELECT id FROM trips WHERE id = ?').get(tripId);
  if (!trip) throw new HttpError(404, 'Trip not found');
  const info = db
    .prepare(
      `INSERT INTO realtime_updates (trip_id, stop_id, delay_minutes, occupancy, source)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(tripId, stopId, delayMinutes, occupancy || null, source || 'manual');
  res.status(201).json(db.prepare('SELECT * FROM realtime_updates WHERE id = ?').get(info.lastInsertRowid));
}));

router.get('/trip/:tripId', h((req, res) => {
  res.json(
    db
      .prepare('SELECT * FROM realtime_updates WHERE trip_id = ? ORDER BY recorded_at DESC')
      .all(req.params.tripId)
  );
}));

export default router;
