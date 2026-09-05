import { MODE_ICON } from '../format';

export function ModeBadge({ mode }) {
  return <span className={`badge ${mode}`}>{MODE_ICON[mode]} {mode}</span>;
}

export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{status.replace(/_/g, ' ')}</span>;
}
