const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  // Network
  stops: (q) => request(`/stops${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  stop: (id) => request(`/stops/${id}`),
  createStop: (body) => request('/stops', { method: 'POST', body: JSON.stringify(body) }),
  zones: () => request('/stops/meta/zones'),
  operators: () => request('/network/operators'),
  vehicles: (operatorId) => request(`/network/vehicles${operatorId ? `?operatorId=${operatorId}` : ''}`),
  createVehicle: (body) => request('/network/vehicles', { method: 'POST', body: JSON.stringify(body) }),
  routes: () => request('/network/routes'),
  route: (id) => request(`/network/routes/${id}`),
  createRoute: (body) => request('/network/routes', { method: 'POST', body: JSON.stringify(body) }),
  setRouteStops: (id, stops) => request(`/network/routes/${id}/stops`, { method: 'PUT', body: JSON.stringify({ stops }) }),

  // Timetable
  trips: (params) => request(`/trips?${new URLSearchParams(params)}`),
  trip: (id) => request(`/trips/${id}`),
  createTrip: (body) => request('/trips', { method: 'POST', body: JSON.stringify(body) }),
  updateTrip: (id, body) => request(`/trips/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTrip: (id) => request(`/trips/${id}`, { method: 'DELETE' }),

  // Search & real-time
  search: (params) => request(`/search?${new URLSearchParams(params)}`),
  departures: (stopId, params) => request(`/search/departures/${stopId}?${new URLSearchParams(params)}`),
  reportRealtime: (body) => request('/realtime', { method: 'POST', body: JSON.stringify(body) }),

  // Products & prices
  products: () => request('/products'),
  product: (id) => request(`/products/${id}`),
  createProduct: (body) => request('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  setPrice: (productId, body) => request(`/products/${productId}/prices`, { method: 'POST', body: JSON.stringify(body) }),
  priceHistory: (productId) => request(`/products/${productId}/prices/history`),

  // Customers
  customers: () => request('/customers'),
  createCustomer: (body) => request('/customers', { method: 'POST', body: JSON.stringify(body) }),

  // Tickets
  ticketsForCustomer: (customerId) => request(`/tickets?customerId=${customerId}`),
  ticket: (id) => request(`/tickets/${id}`),
  purchase: (body) => request('/tickets/purchase', { method: 'POST', body: JSON.stringify(body) }),

  // Validation
  validate: (body) => request('/validations', { method: 'POST', body: JSON.stringify(body) }),
  recentValidations: (limit) => request(`/validations?limit=${limit || 25}`),

  // Reports
  reportSummary: () => request('/reports/summary'),
  reportRevenue: (params = {}) => request(`/reports/revenue?${new URLSearchParams(params)}`),
  reportUsage: (params = {}) => request(`/reports/usage?${new URLSearchParams(params)}`),
  reportPunctuality: (params = {}) => request(`/reports/punctuality?${new URLSearchParams(params)}`),
};
