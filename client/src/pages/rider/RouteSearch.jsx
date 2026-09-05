import { useEffect, useState } from 'react';
import { api } from '../../api';
import { ModeBadge, StatusBadge } from '../../components/Badge';
import { time, today, nowHHMM } from '../../format';

export default function RouteSearch() {
  const [stops, setStops] = useState([]);
  const [fromStopId, setFromStopId] = useState('');
  const [toStopId, setToStopId] = useState('');
  const [date, setDate] = useState(today());
  const [when, setWhen] = useState(nowHHMM());
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.stops().then((rows) => {
      setStops(rows);
      if (rows.length >= 2) {
        setFromStopId(String(rows.find((s) => s.name === 'Riverside Ave')?.id || rows[0].id));
        setToStopId(String(rows.find((s) => s.name === 'Central Station')?.id || rows[1].id));
      }
    });
  }, []);

  async function search(e) {
    e.preventDefault();
    if (fromStopId === toStopId) {
      setError('Origin and destination must be different stops.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const rows = await api.search({ fromStopId, toStopId, date, time: when });
      setResults(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Search for a direct trip</h2>
        <p className="subtitle">Find scheduled departures between two stops, with live delay and crowding where available.</p>
        <form onSubmit={search}>
          <div className="grid-2">
            <div className="field">
              <label>From</label>
              <select value={fromStopId} onChange={(e) => setFromStopId(e.target.value)}>
                {stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>To</label>
              <select value={toStopId} onChange={(e) => setToStopId(e.target.value)}>
                {stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Depart after</label>
              <input type="time" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
          </div>
          {error && <div className="banner error">{error}</div>}
          <button className="btn" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        </form>
      </div>

      {results && (
        <div className="card">
          <h2>Results</h2>
          <p className="subtitle">
            {results.length} direct {results.length === 1 ? 'trip' : 'trips'} found. (Only direct trips are
            searched in this iteration — no transfers yet.)
          </p>
          {results.length === 0 && <div className="empty-state">No direct trips found for this date/time. Try a later time or a different stop pair — routes only connect through the shared Market Square and Central Station interchanges.</div>}
          {results.map((r) => (
            <div key={r.tripId} className="list-row">
              <ModeBadge mode={r.route.mode} />
              <div>
                <strong>{r.route.shortName}</strong> · {r.route.longName}
                <div className="muted">{r.route.operator}</div>
              </div>
              <div className="right">
                <div>
                  <strong>{time(r.scheduledDeparture)}</strong> → {time(r.scheduledArrival)}
                  {r.delayMinutes ? <span className="badge rejected_used" style={{ marginLeft: 8 }}>+{r.delayMinutes} min</span> : null}
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {r.occupancy ? r.occupancy.replace('_', ' ') : 'no live data yet'} · <StatusBadge status={r.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
