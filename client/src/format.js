export function money(cents, currency = 'EUR') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100);
}

export function time(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function dateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function nowHHMM() {
  return new Date().toTimeString().slice(0, 5);
}

export const MODE_ICON = { bus: '🚌', tram: '🚊', train: '🚆' };
