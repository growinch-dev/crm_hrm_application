import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import Pill from '../components/Pill';
import ConfirmDialog from '../components/ConfirmDialog';
import AttachmentsPanel from '../components/AttachmentsPanel';
import useCanEdit from '../hooks/useCanEdit';
import { formatCurrency, formatDate } from '../utils/format';

const CATEGORIES = ['rent', 'utilities', 'software', 'travel', 'marketing', 'other'];

export default function CompanyExpenses() {
  const canEdit = useCanEdit();
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState('software');
  const [vendorName, setVendorName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [attachmentsFor, setAttachmentsFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [expensesRes, accountsRes] = await Promise.all([
      api.get('/accounts/expenses'),
      api.get('/accounts/chart-of-accounts', { params: { limit: 500 } }),
    ]);
    setRows(expensesRes.data.data);
    setAccounts(accountsRes.data.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setVendorName(''); setAccountId(''); setAmount(''); setExpenseDate(''); setNotes(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return; }
    setSaving(true);
    try {
      await api.post('/accounts/expenses', {
        category, vendor_name: vendorName || null, account_id: accountId || null,
        amount, expense_date: expenseDate || undefined, notes: notes || null,
      });
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record expense.');
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (row) => {
    await api.post(`/accounts/expenses/${row.id}/mark-paid`);
    load();
  };

  const remove = async () => {
    await api.delete(`/accounts/expenses/${confirmDelete.id}`);
    setConfirmDelete(null);
    load();
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1>Company Expenses</h1><p className="desc">Rent, utilities, software and other company-level spend — separate from employee expense claims.</p></div>
      </div>

      {canEdit && (
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="section-title">Record an Expense</div>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field-row">
            <div className="field">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Vendor</label>
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. AWS, WeWork" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Amount</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="field">
              <label>Expense Date</label>
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Account</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record Expense'}</button>
        </form>
      </div>
      )}

      {loading ? <div className="loading-row">Loading…</div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Expense #</th><th>Category</th><th>Vendor</th><th>Amount</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.expense_number}</td>
                  <td><Pill value={r.category} /></td>
                  <td>{r.vendor_name || '—'}</td>
                  <td className="mono">{formatCurrency(r.amount)}</td>
                  <td>{formatDate(r.expense_date)}</td>
                  <td><Pill value={r.status} /></td>
                  <td>
                    <div className="row-actions">
                      {canEdit && r.status === 'unpaid' && <button className="btn btn-sm btn-secondary" onClick={() => markPaid(r)}>Mark Paid</button>}
                      <button className="btn btn-sm btn-secondary" onClick={() => setAttachmentsFor(r)}>Files</button>
                      {canEdit && <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(r)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="empty-state">No company expenses recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete expense?"
          message={`This will permanently delete expense ${confirmDelete.expense_number}. This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={remove}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {attachmentsFor && (
        <AttachmentsPanel
          title={`Files — ${attachmentsFor.expense_number}`}
          relatedToType="company_expense"
          relatedToId={attachmentsFor.id}
          onClose={() => setAttachmentsFor(null)}
        />
      )}
    </div>
  );
}
