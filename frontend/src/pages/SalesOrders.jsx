import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import Pill from '../components/Pill';
import useEscapeToClose from '../hooks/useEscapeToClose';
import useCanEdit from '../hooks/useCanEdit';
import { formatCurrency, formatDate } from '../utils/format';

const STATUS_OPTIONS = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export default function SalesOrders() {
  const canEdit = useCanEdit();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEscapeToClose(() => setDetail(null));

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/crm/sales-orders');
    setRows(res.data.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openDetail = async (row) => {
    const res = await api.get(`/crm/sales-orders/${row.id}`);
    setDetail(res.data);
  };

  const updateStatus = async (row, status) => {
    await api.put(`/crm/sales-orders/${row.id}`, { status });
    load();
    if (detail && detail.id === row.id) setDetail({ ...detail, status });
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1>Sales Orders</h1><p className="desc">Confirmed orders, generated from accepted quotations.</p></div>
      </div>

      {loading ? <div className="loading-row">Loading…</div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Order #</th><th>Company</th><th>Total</th><th>Order Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.order_number}</td>
                  <td>{r.company_name || '—'}</td>
                  <td className="mono">{formatCurrency(r.total_amount)}</td>
                  <td>{formatDate(r.order_date)}</td>
                  <td><Pill value={r.status} /></td>
                  <td>
                    <div className="row-actions">
                      {canEdit && (
                        <select value={r.status} onChange={(e) => updateStatus(r, e.target.value)} style={{ padding: '5px 8px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border-2)' }}>
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      <button className="btn btn-sm btn-secondary" onClick={() => openDetail(r)}>View</button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="empty-state">No sales orders yet. Convert an accepted quotation to create one.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal-panel">
            <div className="modal-header"><h3>Order {detail.order_number}</h3><button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button></div>
            <div className="modal-body">
              <p className="muted" style={{ marginBottom: 14 }}>{detail.company_name} &middot; {formatDate(detail.order_date)}</p>
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead>
                <tbody>
                  {detail.items.map((it) => (
                    <tr key={it.id}><td>{it.product_name}</td><td>{it.quantity}</td><td className="mono">{formatCurrency(it.unit_price)}</td><td className="mono">{formatCurrency(it.line_total)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'right', marginTop: 12, fontSize: 14 }}>Total: <strong>{formatCurrency(detail.total_amount)}</strong></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
