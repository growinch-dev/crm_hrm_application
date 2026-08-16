import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import useCanEdit from '../hooks/useCanEdit';
import { formatDateTime } from '../utils/format';

const CRM_TYPES = ['lead', 'company', 'contact', 'deal', 'quotation', 'ticket'];
const HRM_TYPES = ['employee', 'candidate', 'offboarding'];
const COMPANY_TYPES = ['policy', 'license', 'certificate', 'registration', 'insurance', 'other'];

function typesForScope(scope) {
  if (scope === 'hrm') return HRM_TYPES;
  if (scope === 'company') return COMPANY_TYPES;
  return CRM_TYPES;
}

export default function Documents({ scope }) {
  const canEdit = useCanEdit();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const types = typesForScope(scope);
  const [relatedType, setRelatedType] = useState(types[0]);
  const [relatedId, setRelatedId] = useState('');
  const [category, setCategory] = useState('');
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/documents');
    setRows(res.data.data.filter((d) => types.includes(d.related_to_type)));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  useEffect(() => { load(); }, [load]);

  const upload = async (e) => {
    e.preventDefault();
    setError('');
    const file = fileRef.current.files[0];
    if (!file) { setError('Choose a file to upload.'); return; }
    if (scope !== 'company' && !relatedId) { setError('Enter the related record ID this document belongs to.'); return; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('related_to_type', relatedType);
    if (scope !== 'company') formData.append('related_to_id', relatedId);
    formData.append('doc_category', category);
    setUploading(true);
    try {
      await api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      fileRef.current.value = '';
      setRelatedId('');
      setCategory('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    await api.delete(`/documents/${confirmDelete.id}`);
    setConfirmDelete(null);
    load();
  };

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <h1>{scope === 'hrm' ? 'Employee Documents' : scope === 'company' ? 'Company Documents' : 'Document Upload'}</h1>
          <p className="desc">
            {scope === 'company' ? 'Company-wide licenses, policies and certificates.' : `Attach files to any ${types.join(', ')} record.`}
          </p>
        </div>
      </div>

      {canEdit && (
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="section-title">Upload a Document</div>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={upload}>
          <div className="field-row">
            <div className="field">
              <label>{scope === 'company' ? 'Category' : 'Related To (type)'}</label>
              <select value={relatedType} onChange={(e) => setRelatedType(e.target.value)}>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {scope !== 'company' && (
              <div className="field">
                <label>Related Record ID</label>
                <input type="number" value={relatedId} onChange={(e) => setRelatedId(e.target.value)} placeholder="e.g. 12" />
              </div>
            )}
          </div>
          <div className="field-row">
            <div className="field">
              <label>Category (optional)</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. contract, resume, ID proof" />
            </div>
            <div className="field">
              <label>File</label>
              <input type="file" ref={fileRef} />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload Document'}</button>
        </form>
      </div>
      )}

      {loading ? <div className="loading-row">Loading…</div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>File</th><th>Related To</th><th>Category</th><th>Uploaded</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td><a href={d.file_path} target="_blank" rel="noreferrer">{d.file_name}</a></td>
                  <td className="mono">{d.related_to_type}{d.related_to_id ? ` #${d.related_to_id}` : ''}</td>
                  <td>{d.doc_category || '—'}</td>
                  <td>{formatDateTime(d.uploaded_at)}</td>
                  <td><div className="row-actions">{canEdit && <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(d)}>Delete</button>}</div></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="empty-state">No documents uploaded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete document?"
          message={`This will permanently delete "${confirmDelete.file_name}". This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={remove}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
