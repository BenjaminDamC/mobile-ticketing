import { Router } from 'express';
import { db } from '../db/index.js';
import { h, HttpError } from '../util.js';

const router = Router();

function latestRealtimeByStop(tripId) {
  const rows = db
    .prepare(
      `SELECT stop_id, delay_minutes, occupancy, recorded_at
       FROM realtime_updates
       WHERE trip_id = ?
       AND id IN (SELECT MAX(id) FROM realtime_updates WHERE trip_id = ? GROUP BY stop_id)`
    )
    .all(tripId, tripId);
  const byStop = {};
  for (const r of rows) byStop[r.stop_id] = r;
  return byStop;
}

router.get('/', h((req, res) => {
  const { routeId, date } = req.query;
  let sql = `SELECT t.*, r.short_name AS route_short_name, r.long_name AS route_long_name, v.registration AS vehicle_registration,
             (SELECT scheduled_departure FROM stop_times WHERE trip_id = t.id ORDER BY sequence LIMIT 1) AS first_departure
             FROM trips t JOIN routes r ON r.id = t.route_id
             LEFT JOIN vehicles v ON v.id = t.vehicle_id WHERE 1=1`;
  const params = [];
  if (routeId) {
    sql += ' AND t.route_id = ?';
    params.push(routeId);
  }
  if (date) {
    sql += ' AND t.service_date = ?';
    params.push(date);
  }
  sql += ' ORDER BY t.service_date, first_departure';
  res.json(db.prepare(sql).all(...params));
}));

router.get('/:id', h((req, res) => {
  const trip = db
    .prepare(
      `SELECT t.*, r.short_name AS route_short_name, r.long_name AS route_long_name, v.registration AS vehicle_registration
       FROM trips t JOIN routes r ON r.id = t.route_id
       LEFT JOIN vehicles v ON v.id = t.vehicle_id WHERE t.id = ?`
    )
    .get(req.params.id);
  if (!trip) throw new HttpError(404, 'Trip not found');
  const stopTimes = db
    .prepare(
      `SELECT st.*, s.name AS stop_name FROM stop_times st
       JOIN stops s ON s.id = st.stop_id
       WHERE st.trip_id = ? ORDER BY st.sequence`
    )
    .all(req.params.id);
  const realtime = latestRealtimeByStop(req.params.id);
  res.json({
    ...trip,
    stopTimes: stopTimes.map((st) => ({ ...st, realtime: realtime[st.stop_id] || null })),
  });
}));

// Create a trip for a route on a service date, generating stop_times from the route's pattern.
router.post('/', h((req, res) => {
  const { routeId, vehicleId, serviceDate, departureTime } = req.body;
  if (!routeId || !serviceDate || !departureTime) {
    throw new HttpError(400, 'routeId, serviceDate, departureTime (HH:MM) are required');
  }
  const pattern = db
    .prepare('SELECT stop_id, sequence, offset_seconds FROM route_stops WHERE route_id = ? ORDER BY sequence')
    .all(routeId);
  if (pattern.length === 0) throw new HttpError(400, 'Route has no defined stopping pattern');

  const [hh, mm] = departureTime.split(':').map(Number);
  const start = new Date(`${serviceDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`);

  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO trips (route_id, vehicle_id, service_date, status) VALUES (?, ?, ?, ?)')
      .run(routeId, vehicleId || null, serviceDate, 'scheduled');
    const tripId = info.lastInsertRowid;
    for (const stop of pattern) {
      const t = new Date(start.getTime() + stop.offset_seconds * 1000).toISOString();
      db.prepare(
        'INSERT INTO stop_times (trip_id, stop_id, sequence, scheduled_arrival, scheduled_departure) VALUES (?, ?, ?, ?, ?)'
      ).run(tripId, stop.stop_id, stop.sequence, t, t);
    }
    return tripId;
  });

  const tripId = tx();
  res.status(201).json(db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId));
}));

router.patch('/:id', h((req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip) throw new HttpError(404, 'Trip not found');
  const { status, vehicleId } = req.body;
  if (status) {
    if (!['scheduled', 'cancelled', 'completed'].includes(status)) throw new HttpError(400, 'Invalid status');
    db.prepare('UPDATE trips SET status = ? WHERE id = ?').run(status, req.params.id);
  }
  if (vehicleId !== undefined) {
    db.prepare('UPDATE trips SET vehicle_id = ? WHERE id = ?').run(vehicleId, req.params.id);
  }
  res.json(db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id));
}));

router.delete('/:id', h((req, res) => {
  try {
    const info = db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id);
    if (info.changes === 0) throw new HttpError(404, 'Trip not found');
    res.status(204).end();
  } catch (err) {
    if (String(err.message).includes('FOREIGN KEY')) {
      throw new HttpError(409, 'Cannot delete a trip that already has recorded ticket validations');
    }
    throw err;
  }
}));

export default router;
