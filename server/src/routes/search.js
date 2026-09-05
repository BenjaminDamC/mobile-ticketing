import { Router } from 'express';
import { db } from '../db/index.js';
import { h, HttpError } from '../util.js';

const router = Router();

function latestRealtime(tripId, stopId) {
  return db
    .prepare(
      `SELECT delay_minutes, occupancy, recorded_at FROM realtime_updates
       WHERE trip_id = ? AND stop_id = ? ORDER BY recorded_at DESC LIMIT 1`
    )
    .get(tripId, stopId);
}

// Direct-trip route search between two stops, departing at/after a given time.
router.get('/', h((req, res) => {
  const { fromStopId, toStopId, date, time, limit } = req.query;
  if (!fromStopId || !toStopId || !date) {
    throw new HttpError(400, 'fromStopId, toStopId, date are required');
  }
  const now = new Date();
  const isToday = date === now.toISOString().slice(0, 10);
  const afterTime = time ? `${date}T${time}:00.000Z` : (isToday ? now.toISOString() : `${date}T00:00:00.000Z`);
  const max = Number(limit) || 10;

  const rows = db
    .prepare(
      `SELECT
         t.id AS trip_id, t.status AS trip_status,
         r.id AS route_id, r.short_name, r.long_name, r.mode,
         o.name AS operator_name,
         st_from.scheduled_departure AS departure,
         st_to.scheduled_arrival AS arrival,
         st_from.sequence AS from_seq, st_to.sequence AS to_seq
       FROM trips t
       JOIN routes r ON r.id = t.route_id
       JOIN operators o ON o.id = r.operator_id
       JOIN stop_times st_from ON st_from.trip_id = t.id AND st_from.stop_id = ?
       JOIN stop_times st_to ON st_to.trip_id = t.id AND st_to.stop_id = ?
       WHERE t.service_date = ?
         AND st_from.sequence < st_to.sequence
         AND st_from.scheduled_departure >= ?
         AND t.status != 'cancelled'
       ORDER BY st_from.scheduled_departure
       LIMIT ?`
    )
    .all(fromStopId, toStopId, date, afterTime, max);

  const results = rows.map((row) => {
    const rt = latestRealtime(row.trip_id, fromStopId);
    return {
      tripId: row.trip_id,
      route: { id: row.route_id, shortName: row.short_name, longName: row.long_name, mode: row.mode, operator: row.operator_name },
      status: row.trip_status,
      scheduledDeparture: row.departure,
      scheduledArrival: row.arrival,
      delayMinutes: rt?.delay_minutes ?? null,
      occupancy: rt?.occupancy ?? null,
    };
  });
  res.json(results);
}));

// Departure board for a single stop: next departures across all routes serving it.
router.get('/departures/:stopId', h((req, res) => {
  const { stopId } = req.params;
  const { date, time, limit } = req.query;
  const now = new Date();
  const d = date || now.toISOString().slice(0, 10);
  const t = time ? `${d}T${time}:00.000Z` : now.toISOString();
  const max = Number(limit) || 15;

  const rows = db
    .prepare(
      `SELECT
         t.id AS trip_id, t.status AS trip_status,
         r.id AS route_id, r.short_name, r.long_name, r.mode,
         st.scheduled_departure AS departure, st.sequence,
         (SELECT MAX(sequence) FROM route_stops WHERE route_id = r.id) AS last_seq
       FROM trips t
       JOIN routes r ON r.id = t.route_id
       JOIN stop_times st ON st.trip_id = t.id AND st.stop_id = ?
       WHERE t.service_date = ? AND st.scheduled_departure >= ? AND t.status != 'cancelled'
       ORDER BY st.scheduled_departure
       LIMIT ?`
    )
    .all(stopId, d, t, max);

  const finalStopStmt = db.prepare(
    `SELECT s.name FROM route_stops rs JOIN stops s ON s.id = rs.stop_id
     WHERE rs.route_id = ? ORDER BY rs.sequence DESC LIMIT 1`
  );

  const results = rows.map((row) => {
    const rt = latestRealtime(row.trip_id, stopId);
    const destination = finalStopStmt.get(row.route_id);
    return {
      tripId: row.trip_id,
      route: { id: row.route_id, shortName: row.short_name, longName: row.long_name, mode: row.mode },
      destination: destination?.name ?? row.long_name,
      status: row.trip_status,
      scheduledDeparture: row.departure,
      delayMinutes: rt?.delay_minutes ?? null,
      estimatedDeparture: rt
        ? new Date(new Date(row.departure).getTime() + rt.delay_minutes * 60000).toISOString()
        : row.departure,
      occupancy: rt?.occupancy ?? null,
      isFinalStop: row.sequence === row.last_seq,
    };
  });
  res.json(results);
}));

export default router;
