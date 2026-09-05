import { useEffect, useState } from 'react';
import { api } from '../../api';
import { ModeBadge } from '../../components/Badge';

export default function NetworkAdmin() {
  const [operators, setOperators] = useState([]);
  const [stops, setStops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [newStop, setNewStop] = useState({ name: '', mode: 'bus', lat: '', lon: '' });
  const [newRoute, setNewRoute] = useState({ operatorId: '', mode: 'bus', shortName: '', longName: '' });
  const [patternStopId, setPatternStopId] = useState('');
  const [patternOffset, setPatternOffset] = useState('');

  function refresh() {
    api.operators().then(setOperators);
    api.stops().then(setStops);
    api.routes().then(setRoutes);
  }

  useEffect(refresh, []);

  async function openRoute(id) {
    const route = await api.route(id);
    setSelectedRoute(route);
  }

  async function addStop(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createStop({ name: newStop.name, mode: newStop.mode, lat: Number(newStop.lat), lon: Number(newStop.lon) });
      setNewStop({ name: '', mode: 'bus', lat: '', lon: '' });
      setNotice('Stop created.');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createRoute(e) {
    e.preventDefault();
    setError('');
    try {
      const route = await api.createRoute({
        operatorId: Number(newRoute.operatorId),
        mode: newRoute.mode,
        shortName: newRoute.shortName,
        longName: newRoute.longName,
        stops: [],
      });
      setNewRoute({ operatorId: '', mode: 'bus', shortName: '', longName: '' });
      setNotice(`Route ${route.short_name} created — add its stopping pattern below.`);
      refresh();
      openRoute(route.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addStopToPattern() {
    if (!selectedRoute || !patternStopId) return;
    const stops = selectedRoute.stops.map((s) => ({ stopId: s.stop_id, offsetSeconds: s.offset_seconds }));
    stops.push({ stopId: Number(patternStopId), offsetSeconds: (Number(patternOffset) || 0) * 60 });
    await api.setRouteStops(selectedRoute.id, stops);
    setPatternStopId('');
    setPatternOffset('');
    openRoute(selectedRoute.id);
  }

  async function removeFromPattern(stopId) {
    const stops = selectedRoute.stops.filter((s) => s.stop_id !== stopId).map((s) => ({ stopId: s.stop_id, offsetSeconds: s.offset_seconds }));
    await api.setRouteStops(selectedRoute.id, stops);
    openRoute(selectedRoute.id);
  }

  return (
    <div>
      {notice && <div className="banner info">{notice}</div>}
      {error && <div className="banner error">{error}</div>}

      <div className="card">
        <h2>Routes</h2>
        <p className="subtitle">Click a route to edit its stopping pattern.</p>
        {routes.map((r) => (
          <div key={r.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => openRoute(r.id)}>
            <ModeBadge mode={r.mode} />
            <div><strong>{r.short_name}</strong> · {r.long_name}<div className="muted">{r.operator_name}</div></div>
            <button className="btn secondary small right">Edit pattern</button>
          </div>
        ))}
      </div>

      {selectedRoute && (
        <div className="card">
          <h2>{selectedRoute.short_name} — stopping pattern</h2>
          <p className="subtitle">Sequence and typical offset (seconds from trip start) used to generate timetable trips.</p>
          <table>
            <thead><tr><th>#</th><th>Stop</th><th>Offset</th><th></th></tr></thead>
            <tbody>
              {selectedRoute.stops.map((s) => (
                <tr key={s.stop_id}>
                  <td>{s.sequence}</td>
                  <td>{s.name}</td>
                  <td>{Math.round(s.offset_seconds / 60)} min</td>
                  <td><button className="btn danger small" onClick={() => removeFromPattern(s.stop_id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid-2" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Add stop</label>
              <select value={patternStopId} onChange={(e) => setPatternStopId(e.target.value)}>
                <option value="">Select a stop…</option>
                {stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Offset from trip start (minutes)</label>
              <input type="number" value={patternOffset} onChange={(e) => setPatternOffset(e.target.value)} />
            </div>
          </div>
          <button className="btn" onClick={addStopToPattern} disabled={!patternStopId}>Add to pattern</button>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h2>New route</h2>
          <form onSubmit={createRoute}>
            <div className="field">
              <label>Operator</label>
              <select value={newRoute.operatorId} onChange={(e) => setNewRoute({ ...newRoute, operatorId: e.target.value })}>
                <option value="">Select…</option>
                {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Mode</label>
              <select value={newRoute.mode} onChange={(e) => setNewRoute({ ...newRoute, mode: e.target.value })}>
                <option value="bus">Bus</option><option value="tram">Tram</option><option value="train">Train</option>
              </select>
            </div>
            <div className="field"><label>Short name</label><input value={newRoute.shortName} onChange={(e) => setNewRoute({ ...newRoute, shortName: e.target.value })} placeholder="e.g. 42" /></div>
            <div className="field"><label>Long name</label><input value={newRoute.longName} onChange={(e) => setNewRoute({ ...newRoute, longName: e.target.value })} placeholder="e.g. Docklands – Old Town" /></div>
            <button className="btn" disabled={!newRoute.operatorId || !newRoute.shortName || !newRoute.longName}>Create route</button>
          </form>
        </div>

        <div className="card">
          <h2>New stop</h2>
          <form onSubmit={addStop}>
            <div className="field"><label>Name</label><input value={newStop.name} onChange={(e) => setNewStop({ ...newStop, name: e.target.value })} /></div>
            <div className="field">
              <label>Mode</label>
              <select value={newStop.mode} onChange={(e) => setNewStop({ ...newStop, mode: e.target.value })}>
                <option value="bus">Bus</option><option value="tram">Tram</option><option value="train">Train</option>
              </select>
            </div>
            <div className="grid-2">
              <div className="field"><label>Latitude</label><input type="number" step="any" value={newStop.lat} onChange={(e) => setNewStop({ ...newStop, lat: e.target.value })} /></div>
              <div className="field"><label>Longitude</label><input type="number" step="any" value={newStop.lon} onChange={(e) => setNewStop({ ...newStop, lon: e.target.value })} /></div>
            </div>
            <button className="btn" disabled={!newStop.name || newStop.lat === '' || newStop.lon === ''}>Create stop</button>
          </form>
        </div>
      </div>
    </div>
  );
}
