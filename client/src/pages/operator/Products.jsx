import { useEffect, useState } from 'react';
import { api } from '../../api';
import { money, dateTime } from '../../format';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [zones, setZones] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', description: '', validityMinutes: 90, kind: 'single_ride' });
  const [priceForm, setPriceForm] = useState({}); // productId -> { fromZoneId, toZoneId, priceCents }
  const [history, setHistory] = useState(null);

  function refresh() {
    api.products().then(setProducts);
    api.zones().then(setZones);
  }
  useEffect(refresh, []);

  async function createProduct(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createProduct(newProduct);
      setNewProduct({ name: '', description: '', validityMinutes: 90, kind: 'single_ride' });
      setNotice('Product created — add a price below.');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addPrice(productId) {
    const form = priceForm[productId] || {};
    if (!form.priceCents) { setError('Enter a price first.'); return; }
    try {
      await api.setPrice(productId, {
        fromZoneId: form.fromZoneId ? Number(form.fromZoneId) : null,
        toZoneId: form.toZoneId ? Number(form.toZoneId) : null,
        priceCents: Math.round(Number(form.priceCents) * 100),
      });
      setNotice('New price is now in effect; the previous one was closed out automatically.');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(product) {
    await api.updateProduct(product.id, { active: !product.active });
    refresh();
  }

  async function viewHistory(productId) {
    const rows = await api.priceHistory(productId);
    setHistory({ productId, rows });
  }

  return (
    <div>
      {notice && <div className="banner info">{notice}</div>}
      {error && <div className="banner error">{error}</div>}

      {products.map((p) => (
        <div className="card" key={p.id}>
          <h2>{p.name} {!p.active && <span className="badge cancelled">inactive</span>}</h2>
          <p className="subtitle">{p.description} · valid {p.validity_minutes} min · kind: {p.kind}</p>
          <table>
            <thead><tr><th>Zones</th><th>Price</th><th>In effect since</th></tr></thead>
            <tbody>
              {p.prices.map((pr) => (
                <tr key={pr.id}>
                  <td>{pr.from_zone_name ? `${pr.from_zone_name} → ${pr.to_zone_name}` : 'All zones'}</td>
                  <td>{money(pr.price_cents, pr.currency)}</td>
                  <td>{dateTime(pr.valid_from)}</td>
                </tr>
              ))}
              {p.prices.length === 0 && <tr><td colSpan={3} className="muted">No price set yet.</td></tr>}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>From zone</label>
              <select value={priceForm[p.id]?.fromZoneId || ''} onChange={(e) => setPriceForm({ ...priceForm, [p.id]: { ...priceForm[p.id], fromZoneId: e.target.value } })}>
                <option value="">All zones</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>To zone</label>
              <select value={priceForm[p.id]?.toZoneId || ''} onChange={(e) => setPriceForm({ ...priceForm, [p.id]: { ...priceForm[p.id], toZoneId: e.target.value } })}>
                <option value="">All zones</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Price (EUR)</label>
              <input type="number" step="0.01" style={{ width: 100 }} value={priceForm[p.id]?.priceCents || ''} onChange={(e) => setPriceForm({ ...priceForm, [p.id]: { ...priceForm[p.id], priceCents: e.target.value } })} />
            </div>
            <button className="btn" onClick={() => addPrice(p.id)}>Set new price</button>
            <button className="btn secondary" onClick={() => viewHistory(p.id)}>Price history</button>
            <button className="btn secondary" onClick={() => toggleActive(p)}>{p.active ? 'Deactivate' : 'Activate'}</button>
          </div>

          {history?.productId === p.id && (
            <div style={{ marginTop: 14 }}>
              <h3 style={{ fontSize: 13.5 }}>Full price history</h3>
              <table>
                <thead><tr><th>Zones</th><th>Price</th><th>Valid from</th><th>Valid to</th></tr></thead>
                <tbody>
                  {history.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.from_zone_id ? `${r.from_zone_id} → ${r.to_zone_id}` : 'All zones'}</td>
                      <td>{money(r.price_cents, r.currency)}</td>
                      <td>{dateTime(r.valid_from)}</td>
                      <td>{r.valid_to ? dateTime(r.valid_to) : <span className="badge active">current</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      <div className="card">
        <h2>New fare product</h2>
        <form onSubmit={createProduct}>
          <div className="grid-2">
            <div className="field"><label>Name</label><input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} /></div>
            <div className="field">
              <label>Kind</label>
              <select value={newProduct.kind} onChange={(e) => setNewProduct({ ...newProduct, kind: e.target.value })}>
                <option value="single_ride">Single ride</option>
                <option value="day_pass">Day pass</option>
                <option value="weekly_pass">Weekly pass</option>
                <option value="monthly_pass">Monthly pass</option>
              </select>
            </div>
            <div className="field"><label>Validity (minutes)</label><input type="number" value={newProduct.validityMinutes} onChange={(e) => setNewProduct({ ...newProduct, validityMinutes: Number(e.target.value) })} /></div>
            <div className="field"><label>Description</label><input value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} /></div>
          </div>
          <button className="btn" disabled={!newProduct.name}>Create product</button>
        </form>
      </div>
    </div>
  );
}
