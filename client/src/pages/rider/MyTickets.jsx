import { useEffect, useState } from 'react';
import { api } from '../../api';
import { StatusBadge } from '../../components/Badge';
import { money, dateTime } from '../../format';

export default function MyTickets({ customerId }) {
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customerId) return;
    api.ticketsForCustomer(customerId).then(setTickets).catch((e) => setError(e.message));
  }, [customerId]);

  if (!customerId) return <div className="card"><div className="empty-state">Select a rider identity in the header.</div></div>;

  return (
    <div className="card">
      <h2>My tickets</h2>
      <p className="subtitle">Digital tickets purchased by this account, most recent first.</p>
      {error && <div className="banner error">{error}</div>}
      {tickets.length === 0 && <div className="empty-state">No tickets yet — buy one from the "Buy ticket" tab.</div>}
      {tickets.map((t) => (
        <div key={t.id} className="ticket-card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <div className="qr-block" style={{ width: 56, height: 56 }} />
          <div style={{ flex: 1 }}>
            <div><strong>{t.product_name}</strong> {t.from_zone_name ? `· ${t.from_zone_name} → ${t.to_zone_name}` : ''}</div>
            <div className="muted mono">{t.validation_code}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              Purchased {dateTime(t.purchased_at)} · {money(t.price_cents, t.currency)}
              {t.valid_until ? ` · valid until ${dateTime(t.valid_until)}` : ''}
            </div>
          </div>
          <StatusBadge status={t.status} />
        </div>
      ))}
    </div>
  );
}
