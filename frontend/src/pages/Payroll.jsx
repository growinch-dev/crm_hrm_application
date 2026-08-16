import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import Pill from '../components/Pill';
import useEscapeToClose from '../hooks/useEscapeToClose';
import useCanEdit from '../hooks/useCanEdit';
import { formatCurrency } from '../utils/format';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Payroll() {
  const canEdit = useCanEdit();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedRun, setSelectedRun] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [error, setError] = useState('');

  useEscapeToClose(() => setSelectedRun(null));

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/hrm/payroll/runs');
    setRuns(res.data.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const createRun = async () => {
    setError('');
    try {
      await api.post('/hrm/payroll/runs', { month: Number(month), year: Number(year) });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create payroll run (it may already exist for this month).');
    }
  };

  const generate = async (run) => {
    await api.post(`/hrm/payroll/runs/${run.id}/generate`);
    load();
    viewPayslips(run);
  };

  const viewPayslips = async (run) => {
    setSelectedRun(run);
    const res = await api.get('/hrm/payroll/payslips', { params: { payroll_run_id: run.id, limit: 200 } });
    setPayslips(res.data.data);
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1>Payroll</h1><p className="desc">Create monthly payroll runs and generate payslips for active employees.</p></div>
      </div>

      {canEdit && (
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="section-title">New Payroll Run</div>
        {error && <div className="form-error">{error}</div>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Month</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Year</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 100 }} />
          </div>
          <button className="btn btn-primary" onClick={createRun}>Create Run</button>
        </div>
      </div>
      )}

      {loading ? <div className="loading-row">Loading…</div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Period</th><th>Status</th><th>Processed At</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{MONTHS[r.month - 1]} {r.year}</td>
                  <td><Pill value={r.status} /></td>
                  <td>{r.processed_at ? new Date(r.processed_at).toLocaleString('en-IN') : '—'}</td>
                  <td>
                    <div className="row-actions">
                      {canEdit && <button className="btn btn-sm btn-secondary" onClick={() => generate(r)}>{r.status === 'draft' ? 'Generate Payslips' : 'Regenerate'}</button>}
                      <button className="btn btn-sm btn-secondary" onClick={() => viewPayslips(r)}>View Payslips</button>
                    </div>
                  </td>
                </tr>
              ))}
              {runs.length === 0 && <tr><td colSpan={4} className="empty-state">No payroll runs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {selectedRun && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setSelectedRun(null)}>
          <div className="modal-panel" style={{ maxWidth: 640 }}>
            <div className="modal-header"><h3>Payslips &middot; {MONTHS[selectedRun.month - 1]} {selectedRun.year}</h3><button className="btn btn-ghost btn-sm" onClick={() => setSelectedRun(null)}>✕</button></div>
            <div className="modal-body">
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Employee</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Net Pay</th></tr></thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr key={p.id}>
                      <td>{p.first_name} {p.last_name} <span className="mono faint">({p.employee_code})</span></td>
                      <td className="mono">{formatCurrency(p.basic_salary)}</td>
                      <td className="mono">{formatCurrency(p.allowances)}</td>
                      <td className="mono">{formatCurrency(p.deductions)}</td>
                      <td className="mono"><strong>{formatCurrency(p.net_pay)}</strong></td>
                    </tr>
                  ))}
                  {payslips.length === 0 && <tr><td colSpan={5} className="empty-state">No payslips generated yet for this run.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setSelectedRun(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
