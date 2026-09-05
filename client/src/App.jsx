import { useEffect, useState } from 'react';
import { api } from './api';

import RouteSearch from './pages/rider/RouteSearch.jsx';
import Departures from './pages/rider/Departures.jsx';
import Buy from './pages/rider/Buy.jsx';
import MyTickets from './pages/rider/MyTickets.jsx';
import Validate from './pages/rider/Validate.jsx';

import NetworkAdmin from './pages/operator/NetworkAdmin.jsx';
import Timetables from './pages/operator/Timetables.jsx';
import Products from './pages/operator/Products.jsx';
import Reports from './pages/operator/Reports.jsx';

const RIDER_TABS = [
  { key: 'search', label: 'Route search', Component: RouteSearch },
  { key: 'departures', label: 'Departures', Component: Departures },
  { key: 'buy', label: 'Buy ticket', Component: Buy },
  { key: 'tickets', label: 'My tickets', Component: MyTickets },
  { key: 'validate', label: 'Validate', Component: Validate },
];

const OPERATOR_TABS = [
  { key: 'network', label: 'Routes & stops', Component: NetworkAdmin },
  { key: 'timetables', label: 'Timetables', Component: Timetables },
  { key: 'products', label: 'Products & prices', Component: Products },
  { key: 'reports', label: 'Reports', Component: Reports },
];

export default function App() {
  const [mode, setMode] = useState('rider');
  const [tab, setTab] = useState('search');
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(null);

  useEffect(() => {
    api.customers().then((rows) => {
      setCustomers(rows);
      const demo = rows.find((r) => r.email === 'benjamindamc@gmail.com') || rows[0];
      if (demo) setCustomerId(demo.id);
    }).catch(() => {});
  }, []);

  const tabs = mode === 'rider' ? RIDER_TABS : OPERATOR_TABS;
  const active = tabs.find((t) => t.key === tab) || tabs[0];
  const Component = active.Component;

  function switchMode(next) {
    setMode(next);
    setTab(next === 'rider' ? RIDER_TABS[0].key : OPERATOR_TABS[0].key);
  }

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">🚋</span>
          CityLink Transit
        </div>
        <div className="mode-switch">
          <button className={mode === 'rider' ? 'active' : ''} onClick={() => switchMode('rider')}>
            Rider app
          </button>
          <button className={mode === 'operator' ? 'active' : ''} onClick={() => switchMode('operator')}>
            Operator console
          </button>
        </div>
        <nav className="tab-row">
          {tabs.map((t) => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
        {mode === 'rider' && (
          <div className="identity">
            Riding as
            <select value={customerId ?? ''} onChange={(e) => setCustomerId(Number(e.target.value))}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </header>
      <main>
        <Component customerId={customerId} customers={customers} />
      </main>
    </>
  );
}
