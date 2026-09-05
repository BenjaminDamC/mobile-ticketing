import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { ModeBadge } from '../../components/Badge';
import { time } from '../../format';

export default function Departures() {
  const [stops, setStops] = useState([]);
  const [stopId, setStopId] = useState('');
  const [rows, setRows] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.stops().then((rows) => {
      setStops(rows);
      const marketSquare = rows.find((s) => s.name === 'Market Square');
      setStopId(String(marketSquare?.id || rows[0]?.id || ''));
    });
  }, []);

  const load = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await api.departures(id, {});
      setRows(data);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!stopId) return;
    load(stopId);
    const interval = setInterval(() => load(stopId), 15000);
    return () => clearInterval(interval);
  }, [stopId, load]);

  return (
    <div className="card">
      <h2>Live departure board</h2>
      <p className="subtitle">Auto-refreshes every 15 seconds. Estimated time reflects the latest reported delay.</p>
      <div className="field" style={{ maxWidth: 320 }}>
        <label>Stop</label>
        <select value={stopId} onChange={(e) => setStopId(e.target.value)}>
          {stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {error && <div className="banner error">{error}</div>}
      {lastUpdated && <p className="muted" style={{ fontSize: 12 }}>Updated {lastUpdated.toLocaleTimeString()}</p>}
      {rows.length === 0 && <div className="empty-state">No more departures from this stop today.</div>}
      {rows.map((r) => (
        <div key={r.tripId} className="list-row">
          <ModeBadge mode={r.route.mode} />
          <div>
            <strong>{r.route.shortName}</strong> to {r.destination}
          </div>
          <div className="right">
            <div>
              <strong>{time(r.estimatedDeparture)}</strong>
              {r.delayMinutes ? (
                <span className="muted" style={{ textDecoration: 'line-through', marginLeft: 6 }}>{time(r.scheduledDeparture)}</span>
              ) : null}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              {r.delayMinutes == null ? 'scheduled' : r.delayMinutes === 0 ? 'on time' : `+${r.delayMinutes} min delay`}
              {r.occupancy ? ` · ${r.occupancy.replace('_', ' ')}` : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
