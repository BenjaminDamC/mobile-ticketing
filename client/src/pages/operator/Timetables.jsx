import { useEffect, useState } from 'react';
import { api } from '../../api';
import { StatusBadge } from '../../components/Badge';
import { time, today } from '../../format';

export default function Timetables() {
  const [routes, setRoutes] = useState([]);
  const [routeId, setRouteId] = useState('');
  const [date, setDate] = useState(today());
  const [trips, setTrips] = useState([]);
  const [departureTime, setDepartureTime] = useState('08:00');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedTrip, setSelectedTrip] = useState(null);

  useEffect(() => {
    api.routes().then((rows) => {
      setRoutes(rows);
      if (rows[0]) setRouteId(String(rows[0].id));
    });
  }, []);

  function load() {
    if (!routeId) return;
    api.trips({ routeId, date }).then(setTrips).catch((e) => setError(e.message));
  }

  useEffect(load, [routeId, date]);

  async function addTrip(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createTrip({ routeId: Number(routeId), serviceDate: date, departureTime });
      setNotice(`Trip added at ${departureTime}.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setStatus(tripId, status) {
    await api.updateTrip(tripId, { status });
    load();
  }

  async function viewTrip(tripId) {
    const trip = await api.trip(tripId);
    setSelectedTrip(trip);
  }

  async function removeTrip(tripId) {
    try {
      await api.deleteTrip(tripId);
      setSelectedTrip(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {notice && <div className="banner info">{notice}</div>}
      {error && <div className="banner error">{error}</div>}

      <div className="card">
        <h2>Timetable</h2>
        <p className="subtitle">Trips are generated from the route's stopping pattern — add a departure time and every stop's schedule is filled in automatically.</p>
        <div className="grid-2">
          <div className="field">
            <label>Route</label>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.short_name} — {r.long_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Service date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <form onSubmit={addTrip} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>New departure time</label>
            <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} />
          </div>
          <button className="btn">Add trip</button>
        </form>

        <table>
          <thead><tr><th>Departure</th><th>Status</th><th>Vehicle</th><th></th></tr></thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id}>
                <td><a href="#" onClick={(e) => { e.preventDefault(); viewTrip(t.id); }}>{time(t.first_departure)} · Trip #{t.id}</a></td>
                <td><StatusBadge status={t.status} /></td>
                <td>{t.vehicle_registration || '—'}</td>
                <td>
                  {t.status !== 'cancelled' && <button className="btn secondary small" onClick={() => setStatus(t.id, 'cancelled')}>Cancel</button>}
                  {t.status === 'cancelled' && <button className="btn secondary small" onClick={() => setStatus(t.id, 'scheduled')}>Reinstate</button>}
                </td>
              </tr>
            ))}
            {trips.length === 0 && <tr><td colSpan={4} className="muted">No trips for this route/date yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedTrip && (
        <div className="card">
          <h2>Trip #{selectedTrip.id} — Route {selectedTrip.route_short_name}</h2>
          <p className="subtitle">{selectedTrip.service_date} · <StatusBadge status={selectedTrip.status} /> · vehicle {selectedTrip.vehicle_registration || 'unassigned'}</p>
          <table>
            <thead><tr><th>Stop</th><th>Scheduled</th><th>Live delay</th><th>Occupancy</th></tr></thead>
            <tbody>
              {selectedTrip.stopTimes.map((st) => (
                <tr key={st.sequence}>
                  <td>{st.stop_name}</td>
                  <td>{time(st.scheduled_departure)}</td>
                  <td>{st.realtime ? `+${st.realtime.delay_minutes} min` : '—'}</td>
                  <td>{st.realtime?.occupancy?.replace('_', ' ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn danger" onClick={() => removeTrip(selectedTrip.id)}>Delete trip</button>
            <button className="btn secondary" onClick={() => setSelectedTrip(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
