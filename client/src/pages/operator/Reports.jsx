import { useEffect, useState } from 'react';
import { api } from '../../api';
import { money } from '../../format';

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [usage, setUsage] = useState(null);
  const [punctuality, setPunctuality] = useState(null);
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(daysAgo(0));

  function load() {
    api.reportSummary().then(setSummary);
    api.reportRevenue({ from, to }).then(setRevenue);
    api.reportUsage({ from, to }).then(setUsage);
    api.reportPunctuality({ from, to }).then(setPunctuality);
  }
  useEffect(load, [from, to]);

  return (
    <div>
      <div className="card">
        <h2>Reporting window</h2>
        <div className="grid-2">
          <div className="field"><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field"><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </div>

      {summary && (
        <div className="stat-row">
          <div className="stat"><div className="value">{money(summary.totalRevenueCents)}</div><div className="label">All-time revenue</div></div>
          <div className="stat"><div className="value">{summary.totalValidations}</div><div className="label">Accepted validations</div></div>
          <div className="stat"><div className="value">{summary.activeTickets}</div><div className="label">Active tickets right now</div></div>
          <div className="stat"><div className="value">{summary.failedPayments}</div><div className="label">Failed payments</div></div>
        </div>
      )}

      {revenue && (
        <div className="card">
          <h2>Revenue by day / product</h2>
          <p className="subtitle">{money(revenue.totalRevenueCents)} across {revenue.totalPayments} successful payments in this window.</p>
          <table>
            <thead><tr><th>Day</th><th>Product</th><th>Payments</th><th>Revenue</th></tr></thead>
            <tbody>
              {revenue.rows.map((r, i) => (
                <tr key={i}><td>{r.day}</td><td>{r.product_name}</td><td>{r.payment_count}</td><td>{money(r.revenue_cents)}</td></tr>
              ))}
              {revenue.rows.length === 0 && <tr><td colSpan={4} className="muted">No revenue in this window.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {usage && (
        <div className="card">
          <h2>Usage by day / route / stop</h2>
          <p className="subtitle">{usage.totalValidations} accepted validations in this window.</p>
          <table>
            <thead><tr><th>Day</th><th>Route</th><th>Stop</th><th>Validations</th></tr></thead>
            <tbody>
              {usage.rows.slice(0, 40).map((r, i) => (
                <tr key={i}><td>{r.day}</td><td>{r.route_short_name || '—'}</td><td>{r.stop_name || '—'}</td><td>{r.validation_count}</td></tr>
              ))}
              {usage.rows.length === 0 && <tr><td colSpan={4} className="muted">No validations in this window.</td></tr>}
            </tbody>
          </table>
          {usage.rows.length > 40 && <p className="muted">Showing top 40 of {usage.rows.length} rows.</p>}
        </div>
      )}

      {punctuality && (
        <div className="card">
          <h2>Punctuality by day / route</h2>
          <p className="subtitle">Average reported delay, from the real-time feed.</p>
          <table>
            <thead><tr><th>Day</th><th>Route</th><th>Avg delay</th><th>Samples</th></tr></thead>
            <tbody>
              {punctuality.rows.slice(0, 40).map((r, i) => (
                <tr key={i}><td>{r.day}</td><td>{r.route_short_name}</td><td>{r.avg_delay_minutes.toFixed(1)} min</td><td>{r.sample_count}</td></tr>
              ))}
              {punctuality.rows.length === 0 && <tr><td colSpan={4} className="muted">No real-time data in this window.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
