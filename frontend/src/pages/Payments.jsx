import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import Pill from '../components/Pill';
import ConfirmDialog from '../components/ConfirmDialog';
import useCanEdit from '../hooks/useCanEdit';
import { formatCurrency, formatDate } from '../utils/format';

const METHODS = ['cash', 'bank_transfer', 'upi', 'cheque', 'card'];

export default function Payments() {
  const canEdit = useCanEdit();
  const [rows, setRows] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState('receipt');
  const [invoiceId, setInvoiceId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [paymentsRes, invoicesRes, accountsRes] = await Promise.all([
      api.get('/accounts/payments'),
      api.get('/accounts/invoices'),
      api.get('/accounts/chart-of-accounts', { params: { limit: 500 } }),
    ]);
    setRows(paymentsRes.data.data);
    setInvoices(invoicesRes.data.data);
    setAccounts(accountsRes.data.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setInvoiceId(''); setAccountId(''); setPartyName(''); setAmount('');
    setPaymentDate(''); setReferenceNo(''); setNotes('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return; }
    setSaving(true);
    try {
      await api.post('/accounts/payments', {
        type, invoice_id: invoiceId || null, account_id: accountId || null, party_name: partyName || null,
        amount, payment_date: paymentDate || undefined, method, reference_no: referenceNo || null, notes: notes || null,
      });
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await api.delete(`/accounts/payments/${confirmDelete.id}`);
    setConfirmDelete(null);
    load();
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1>Payments</h1><p className="desc">Record money received from customers or paid out, optionally against an invoice.</p></div>
      </div>

      {canEdit && (
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="section-title">Record a Payment</div>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field-row">
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="receipt">Receipt (money in)</option>
                <option value="payment">Payment (money out)</option>
              </select>
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Against Invoice (optional)</label>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
                <option value="">None</option>
                {invoices.filter((i) => i.status !== 'paid').map((i) => (
                  <option key={i.id} value={i.id}>{i.invoice_number} — {i.company_name || 'No company'} ({formatCurrency(i.total_amount - i.amount_paid)} due)</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Select…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Party Name (if no invoice)</label>
              <input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="e.g. vendor name" />
            </div>
            <div className="field">
              <label>Payment Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Reference No.</label>
              <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
        </form>
      </div>
      )}

      {loading ? <div className="loading-row">Loading…</div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Payment #</th><th>Type</th><th>Invoice</th><th>Amount</th><th>Date</th><th>Method</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.payment_number}</td>
                  <td><Pill value={r.type} /></td>
                  <td>{r.invoice_number || '—'}</td>
                  <td className="mono">{formatCurrency(r.amount)}</td>
                  <td>{formatDate(r.payment_date)}</td>
                  <td>{r.method ? r.method.replace(/_/g, ' ') : '—'}</td>
                  <td><div className="row-actions">{canEdit && <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(r)}>Delete</button>}</div></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="empty-state">No payments recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete payment?"
          message={`This will permanently delete payment ${confirmDelete.payment_number}. This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={remove}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
