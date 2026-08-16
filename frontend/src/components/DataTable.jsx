import Pill from './Pill';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';

function Cell({ column, row }) {
  const val = row[column.key];
  switch (column.type) {
    case 'pill': return <Pill value={val} colorMap={column.pillMap} />;
    case 'currency': return <span className="mono">{formatCurrency(val)}</span>;
    case 'date': return <span>{formatDate(val)}</span>;
    case 'datetime': return <span>{formatDateTime(val)}</span>;
    case 'mono': return <span className="mono">{val || '—'}</span>;
    case 'boolean': return val ? <Pill value="yes" colorMap={{ yes: 'green' }} /> : <Pill value="no" colorMap={{ no: 'gray' }} />;
    default: return <span>{val === null || val === undefined || val === '' ? <span className="faint">—</span> : String(val)}</span>;
  }
}

export default function DataTable({ columns, rows, loading, onEdit, onDelete, rowActions = [], api, onRowActionDone, emptyLabel = 'records' }) {
  if (loading) return <div className="loading-row">Loading…</div>;

  if (!rows || rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">▢</div>
        <h4>No {emptyLabel} yet</h4>
        <p>Create your first record using the button above.</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => <td key={c.key}><Cell column={c} row={row} /></td>)}
              <td>
                <div className="row-actions">
                  {rowActions.filter((a) => !a.hideIf || !a.hideIf(row)).map((a) => (
                    <button
                      key={a.label}
                      className={`btn btn-sm ${a.variant || 'btn-secondary'}`}
                      onClick={async () => { await a.action(row, api); onRowActionDone && onRowActionDone(); }}
                    >
                      {a.label}
                    </button>
                  ))}
                  {onEdit && <button className="btn btn-sm btn-secondary" onClick={() => onEdit(row)}>Edit</button>}
                  {onDelete && <button className="btn btn-sm btn-danger" onClick={() => onDelete(row)}>Delete</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
