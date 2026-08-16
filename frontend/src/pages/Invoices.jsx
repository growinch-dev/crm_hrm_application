import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import Pill from '../components/Pill';
import AttachmentsPanel from '../components/AttachmentsPanel';
import useEscapeToClose from '../hooks/useEscapeToClose';
import useCanEdit from '../hooks/useCanEdit';
import { formatCurrency, formatDate } from '../utils/format';

function emptyItem() { return { product_id: '', quantity: 1, unit_price: 0, tax_percent: 0 }; }

function InvoiceForm({ initial, onClose, onSaved }) {
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [products, setProducts] = useState([]);
  const [companyId, setCompanyId] = useState(initial?.company_id || '');
  const [contactId, setContactId] = useState(initial?.contact_id || '');
  const [dueDate, setDueDate] = useState(initial?.due_date ? String(initial.due_date).slice(0, 10) : '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [items, setItems] = useState(initial?.items?.length ? initial.items.map((it) => ({ product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price, tax_percent: it.tax_percent })) : [emptyItem()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEscapeToClose(onClose);

  useEffect(() => {
    api.get('/crm/companies', { params: { limit: 500 } }).then((r) => setCompanies(r.data.data));
    api.get('/crm/contacts', { params: { limit: 500 } }).then((r) => setContacts(r.data.data));
    api.get('/crm/products', { params: { limit: 500 } }).then((r) => setProducts(r.data.data));
  }, []);

  const updateItem = (idx, key, val) => {
    setItems((its) => its.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [key]: val };
      if (key === 'product_id') {
        const p = products.find((pp) => pp.id === Number(val));
        if (p) { updated.unit_price = p.unit_price; updated.tax_percent = p.tax_percent; }
      }
      return updated;
    }));
  };
  const addItem = () => setItems((its) => [...its, emptyItem()]);
  const removeItem = (idx) => setItems((its) => its.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
  const taxTotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0) * (Number(it.tax_percent || 0) / 100), 0);

  const handleSave = async () => {
    setError('');
    if (items.every((it) => !it.product_id)) { setError('Add at least one line item.'); return; }
    setSaving(true);
    try {
      const payload = { company_id: companyId || null, contact_id: contactId || null, due_date: dueDate || null, notes, items: items.filter((it) => it.product_id) };
      if (initial) await api.put(`/accounts/invoices/${initial.id}`, payload);
      else await api.post('/accounts/invoices', payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: 680 }}>
        <div className="modal-header"><h3>{initial ? `Edit Invoice ${initial.invoice_number}` : 'New Invoice'}</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="field-row">
            <div className="field">
              <label>Company</label>
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">Select…</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Contact</label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">Select…</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="section-title" style={{ marginTop: 16 }}>Line Items</div>
          {items.map((it, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr 0.8fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select value={it.product_id} onChange={(e) => updateItem(idx, 'product_id', e.target.value)}>
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
              <input type="number" placeholder="Unit price" value={it.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} />
              <input type="number" placeholder="Tax %" value={it.tax_percent} onChange={(e) => updateItem(idx, 'tax_percent', e.target.value)} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeItem(idx)}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ Add line item</button>

          <div className="divider" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, fontSize: 13.5 }}>
            <span>Subtotal: <strong>{formatCurrency(subtotal)}</strong></span>
            <span>Tax: <strong>{formatCurrency(taxTotal)}</strong></span>
            <span>Total: <strong>{formatCurrency(subtotal + taxTotal)}</strong></span>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Invoice'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Invoices() {
  const canEdit = useCanEdit();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [attachmentsFor, setAttachmentsFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/accounts/invoices');
    setRows(res.data.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openEdit = async (row) => {
    const res = await api.get(`/accounts/invoices/${row.id}`);
    setEditing(res.data);
    setModalOpen(true);
  };

  const updateStatus = async (row, status) => {
    await api.put(`/accounts/invoices/${row.id}`, { status });
    load();
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1>Invoices</h1><p className="desc">Bill customers and track how much of each invoice has been collected.</p></div>
        {canEdit && <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>+ New Invoice</button>}
      </div>

      {loading ? <div className="loading-row">Loading…</div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Invoice #</th><th>Company</th><th>Total</th><th>Paid</th><th>Due Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.invoice_number}</td>
                  <td>{r.company_name || '—'}</td>
                  <td className="mono">{formatCurrency(r.total_amount)}</td>
                  <td className="mono">{formatCurrency(r.amount_paid)}</td>
                  <td>{formatDate(r.due_date)}</td>
                  <td><Pill value={r.status} /></td>
                  <td>
                    <div className="row-actions">
                      {canEdit && r.status === 'draft' && <button className="btn btn-sm btn-secondary" onClick={() => updateStatus(r, 'sent')}>Mark Sent</button>}
                      {canEdit && <button className="btn btn-sm btn-secondary" onClick={() => openEdit(r)}>Edit</button>}
                      <button className="btn btn-sm btn-secondary" onClick={() => setAttachmentsFor(r)}>Files</button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="empty-state">No invoices yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <InvoiceForm initial={editing} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load(); }} />}

      {attachmentsFor && (
        <AttachmentsPanel
          title={`Files — ${attachmentsFor.invoice_number}`}
          relatedToType="invoice"
          relatedToId={attachmentsFor.id}
          onClose={() => setAttachmentsFor(null)}
        />
      )}
    </div>
  );
}
