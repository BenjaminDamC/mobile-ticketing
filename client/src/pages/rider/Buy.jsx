import { useEffect, useState } from 'react';
import { api } from '../../api';
import { money } from '../../format';

export default function Buy({ customerId }) {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [priceId, setPriceId] = useState('');
  const [method, setMethod] = useState('card');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.products().then((rows) => {
      setProducts(rows.filter((p) => p.active));
      if (rows[0]) {
        setProductId(String(rows[0].id));
        setPriceId(String(rows[0].prices[0]?.id || ''));
      }
    });
  }, []);

  const product = products.find((p) => String(p.id) === productId);

  function onProductChange(id) {
    setProductId(id);
    const p = products.find((p) => String(p.id) === id);
    setPriceId(String(p?.prices[0]?.id || ''));
  }

  async function buy(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!customerId) { setError('Select a rider identity in the header first.'); return; }
    setLoading(true);
    try {
      const ticket = await api.purchase({ customerId, farePriceId: Number(priceId), method });
      setResult(ticket);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Buy a digital ticket</h2>
        <p className="subtitle">Prices are versioned — you always pay whatever price is currently in effect.</p>
        <form onSubmit={buy}>
          <div className="grid-2">
            <div className="field">
              <label>Product</label>
              <select value={productId} onChange={(e) => onProductChange(e.target.value)}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {product && product.prices.length > 1 && (
              <div className="field">
                <label>Zones</label>
                <select value={priceId} onChange={(e) => setPriceId(e.target.value)}>
                  {product.prices.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.from_zone_name ? `${pr.from_zone_name} → ${pr.to_zone_name}` : 'All zones'} — {money(pr.price_cents, pr.currency)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label>Payment method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="card">Card</option>
                <option value="wallet">Mobile wallet</option>
                <option value="cash">Cash (at kiosk)</option>
                <option value="card_declined_demo">Card (simulate decline)</option>
              </select>
            </div>
          </div>
          {product && (
            <p className="muted">
              {product.description}
            </p>
          )}
          {error && <div className="banner error">{error}</div>}
          <button className="btn" disabled={loading || !priceId}>{loading ? 'Processing payment…' : 'Buy ticket'}</button>
        </form>
      </div>

      {result && (
        <div className="card">
          <h2>Purchase complete</h2>
          <div className="ticket-card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="qr-block" />
            <div>
              <div><strong>{result.product_name}</strong></div>
              <div className="muted">{money(result.price_cents, result.currency)} · code <span className="mono">{result.validation_code}</span></div>
              <div className="muted" style={{ marginTop: 4 }}>Valid {result.validity_minutes} minutes from first tap-in.</div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>Head to "My tickets" to view it, or "Validate" to simulate tapping in.</p>
        </div>
      )}
    </div>
  );
}
