import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import useCanEdit from '../hooks/useCanEdit';

export default function GenericListPage({ module }) {
  const canEdit = useCanEdit();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(module.api, { params: { q: q || undefined, page, limit: 20 } });
      setRows(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load', module.key, err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [module, q, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, module.key]);

  const handleCreate = () => { setEditingRow(null); setModalOpen(true); };
  const handleEdit = (row) => { setEditingRow(row); setModalOpen(true); };

  const handleSubmit = async (payload) => {
    if (editingRow) {
      await api.put(`${module.api}/${editingRow.id}`, payload);
    } else {
      await api.post(module.api, payload);
    }
    setModalOpen(false);
    load();
  };

  const handleDelete = async () => {
    setDeleteError('');
    try {
      await api.delete(`${module.api}/${confirmDelete.id}`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete this record.');
    }
  };

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <h1>{module.label}</h1>
          {module.description && <p className="desc">{module.description}</p>}
        </div>
        {canEdit && <button className="btn btn-primary" onClick={handleCreate}>+ New {module.label.replace(/s$/, '')}</button>}
      </div>

      <div className="table-toolbar">
        <div className="search-box">
          <input placeholder={`Search ${module.label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="muted" style={{ fontSize: 12.5 }}>{pagination.total} total</span>
      </div>

      <DataTable
        columns={module.columns}
        rows={rows}
        loading={loading}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={canEdit ? (row) => { setDeleteError(''); setConfirmDelete(row); } : undefined}
        rowActions={canEdit ? (module.rowActions || []) : []}
        api={api}
        onRowActionDone={load}
        emptyLabel={module.label.toLowerCase()}
      />

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <span>Page {page} of {pagination.totalPages}</span>
          <div className="controls">
            <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn btn-sm btn-secondary" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {modalOpen && (
        <FormModal
          title={editingRow ? `Edit ${module.label.replace(/s$/, '')}` : `New ${module.label.replace(/s$/, '')}`}
          fields={module.fields}
          initialData={editingRow}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete record?"
          message={`This will permanently delete this ${module.label.toLowerCase().replace(/s$/, '')}. This can't be undone.`}
          error={deleteError}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
