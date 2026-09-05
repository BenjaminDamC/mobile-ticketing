import { useEffect, useState } from 'react';
import { api } from '../../api';
import { StatusBadge } from '../../components/Badge';

export default function Validate({ customerId }) {
  const [myTickets, setMyTickets] = useState([]);
  const [code, setCode] = useState('');
  const [stops, setStops] = useState([]);
  const [stopId, setStopId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.stops().then(setStops);
  }, []);

  useEffect(() => {
    if (customerId) api.ticketsForCustomer(customerId).then(setMyTickets);
  }, [customerId, result]);

  async function validate(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!code.trim()) { setError('Enter or pick a validation code first.'); return; }
    setLoading(true);
    try {
      const outcome = await api.validate({ validationCode: code.trim(), stopId: stopId || undefined });
      setResult(outcome);
    } catch (err) {
      if (err.body) setResult(err.body); else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Validator (tap-in simulator)</h2>
        <p className="subtitle">Stands in for the onboard/at-gate scanner: paste a ticket's code, or pick one of your own below.</p>
        <form onSubmit={validate}>
          <div className="grid-2">
            <div className="field">
              <label>Validation code</label>
              <input className="mono" placeholder="e.g. 5CGdNMpvXNjZ" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="field">
              <label>At stop (optional context)</label>
              <select value={stopId} onChange={(e) => setStopId(e.target.value)}>
                <option value="">—</option>
                {stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {error && <div className="banner error">{error}</div>}
          <button className="btn" disabled={loading}>{loading ? 'Scanning…' : 'Scan / validate'}</button>
        </form>

        {result && (
          <div className={`banner ${result.result === 'accepted' ? 'success' : 'error'}`} style={{ marginTop: 16 }}>
            <StatusBadge status={result.result} /> <strong style={{ marginLeft: 6 }}>{result.message}</strong>
          </div>
        )}
      </div>

      {customerId && (
        <div className="card">
          <h2>Your ticket codes</h2>
          <p className="subtitle">Quick-pick a code to simulate scanning your own phone.</p>
          {myTickets.length === 0 && <div className="empty-state">No tickets yet.</div>}
          {myTickets.map((t) => (
            <div key={t.id} className="list-row">
              <div>
                <strong>{t.product_name}</strong> <span className="mono muted">{t.validation_code}</span>
              </div>
              <StatusBadge status={t.status} />
              <button className="btn secondary small right" onClick={() => setCode(t.validation_code)}>Use this code</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
