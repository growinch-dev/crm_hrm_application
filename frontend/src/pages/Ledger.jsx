import { useEffect, useState } from 'react';
import api from '../api/client';
import StatCard from '../components/StatCard';
import Pill from '../components/Pill';
import { formatCurrency } from '../utils/format';

export default function Ledger() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/accounts/ledger').then((res) => setData(res.data)).catch(() => setData(null));
  }, []);

  if (!data) return <div className="content"><div className="loading-row">Loading ledger…</div></div>;

  const { accounts, summary } = data;

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <h1>Ledger</h1>
          <p className="desc">A simple running balance per account, plus overall invoicing totals.</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Invoiced" value={formatCurrency(summary.total_invoiced)} />
        <StatCard label="Total Collected" value={formatCurrency(summary.total_collected)} />
        <StatCard label="Outstanding" value={formatCurrency(summary.outstanding)} />
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Money In</th><th>Money Out</th><th>Balance</th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.code}</td>
                <td>{a.name}</td>
                <td><Pill value={a.type} /></td>
                <td className="mono">{formatCurrency(a.total_in)}</td>
                <td className="mono">{formatCurrency(a.total_out)}</td>
                <td className="mono">{formatCurrency(Number(a.total_in) - Number(a.total_out))}</td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={6} className="empty-state">No chart of accounts entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
