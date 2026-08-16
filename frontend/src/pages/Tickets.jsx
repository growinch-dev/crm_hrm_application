import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import Pill from '../components/Pill';
import FormModal from '../components/FormModal';
import useEscapeToClose from '../hooks/useEscapeToClose';
import useCanEdit from '../hooks/useCanEdit';
import { formatDateTime } from '../utils/format';

const ticketFields = [
  { key: 'subject', label: 'Subject', type: 'text', required: true },
  { key: 'company_id', label: 'Company', type: 'select-async', optionsEndpoint: '/crm/companies' },
  { key: 'contact_id', label: 'Contact', type: 'select-async', optionsEndpoint: '/crm/contacts', optionsLabel: 'first_name' },
  { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] },
  { key: 'status', label: 'Status', type: 'select', options: ['open', 'in_progress', 'on_hold', 'resolved', 'closed'] },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'assigned_to', label: 'Assigned To', type: 'select-async', optionsEndpoint: '/users' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

function TicketDetail({ ticket, onClose, onChanged }) {
  const canEdit = useCanEdit();
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEscapeToClose(onClose);

  const load = useCallback(async () => {
    const res = await api.get(`/crm/tickets/${ticket.id}/comments`);
    setComments(res.data);
    setLoading(false);
  }, [ticket.id]);
  useEffect(() => { load(); }, [load]);

  const post = async () => {
    if (!comment.trim()) return;
    await api.post(`/crm/tickets/${ticket.id}/comments`, { comment });
    setComment('');
    load();
  };

  const updateStatus = async (status) => {
    await api.put(`/crm/tickets/${ticket.id}`, { status });
    onChanged();
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h3>{ticket.ticket_number} &middot; {ticket.subject}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="muted" style={{ marginBottom: 12 }}>{ticket.description}</p>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['open', 'in_progress', 'on_hold', 'resolved', 'closed'].map((s) => (
                <button key={s} className={`btn btn-sm ${ticket.status === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateStatus(s)}>{s.replace('_', ' ')}</button>
              ))}
            </div>
          )}
          <div className="section-title">Comments</div>
          {loading ? <div className="loading-row">Loading…</div> : (
            <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 12 }}>
              {comments.length === 0 && <p className="faint" style={{ fontSize: 13 }}>No comments yet.</p>}
              {comments.map((c) => (
                <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.user_name || 'Unknown'} <span className="faint" style={{ fontWeight: 400 }}>&middot; {formatDateTime(c.created_at)}</span></div>
                  <div style={{ fontSize: 13.5, marginTop: 3 }}>{c.comment}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ flex: 1, padding: '8px 11px', border: '1px solid var(--border-2)', borderRadius: 6 }} placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && post()} />
            <button className="btn btn-primary btn-sm" onClick={post}>Post</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Tickets() {
  const canEdit = useCanEdit();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/crm/tickets');
    setRows(res.data.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="content">
      <div className="page-header">
        <div><h1>Support Tickets</h1><p className="desc">Track and resolve customer support requests.</p></div>
        {canEdit && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>+ New Ticket</button>}
      </div>

      {loading ? <div className="loading-row">Loading…</div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Ticket #</th><th>Subject</th><th>Priority</th><th>Status</th><th>Assigned To</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.ticket_number}</td>
                  <td>{r.subject}</td>
                  <td><Pill value={r.priority} /></td>
                  <td><Pill value={r.status} /></td>
                  <td>{r.assigned_to_name || '—'}</td>
                  <td><div className="row-actions"><button className="btn btn-sm btn-secondary" onClick={() => setDetailTicket(r)}>Open</button></div></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="empty-state">No tickets yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <FormModal title="New Ticket" fields={ticketFields} onClose={() => setCreateOpen(false)} onSubmit={async (payload) => { await api.post('/crm/tickets', payload); setCreateOpen(false); load(); }} />
      )}
      {detailTicket && <TicketDetail ticket={detailTicket} onClose={() => setDetailTicket(null)} onChanged={() => { load(); setDetailTicket(null); }} />}
    </div>
  );
}
