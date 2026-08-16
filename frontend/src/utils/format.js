export function defaultPillColor(value) {
  const v = String(value || '').toLowerCase();
  if (['won', 'approved', 'completed', 'active', 'paid', 'resolved', 'closed', 'present', 'hired', 'accepted'].includes(v)) return 'green';
  if (['pending', 'draft', 'new', 'scheduled', 'initiated', 'applied', 'screening', 'available'].includes(v)) return 'amber';
  if (['lost', 'rejected', 'cancelled', 'absent', 'urgent', 'high', 'exited', 'on_hold', 'unqualified', 'missed', 'dropped'].includes(v)) return 'red';
  if (['in_progress', 'contacted', 'sent', 'confirmed', 'shipped', 'interview', 'offer', 'ongoing', 'half_day', 'wfh'].includes(v)) return 'blue';
  if (['qualified', 'converted', 'enrolled', 'assigned', 'negotiation', 'proposal'].includes(v)) return 'violet';
  return 'gray';
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}
