import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import useEscapeToClose from '../hooks/useEscapeToClose';
import useCanEdit from '../hooks/useCanEdit';
import { formatDateTime } from '../utils/format';

// Small self-contained modal for attaching/viewing files against any record
// (invoices, company expenses, ...) via the existing generic /api/documents endpoint.
export default function AttachmentsPanel({ title, relatedToType, relatedToId, onClose }) {
  const canEdit = useCanEdit();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEscapeToClose(onClose);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/documents', { params: { related_to_type: relatedToType, related_to_id: relatedToId } });
    setRows(res.data.data);
    setLoading(false);
  }, [relatedToType, relatedToId]);
  useEffect(() => { load(); }, [load]);

  const upload = async (e) => {
    e.preventDefault();
    setError('');
    const file = fileRef.current.files[0];
    if (!file) { setError('Choose a file to upload.'); return; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('related_to_type', relatedToType);
    formData.append('related_to_id', relatedToId);
    setUploading(true);
    try {
      await api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      fileRef.current.value = '';
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (doc) => {
    await api.delete(`/documents/${doc.id}`);
    load();
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: 480 }}>
        <div className="modal-header"><h3>{title || 'Attachments'}</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          {canEdit && (
            <form onSubmit={upload} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input type="file" ref={fileRef} style={{ flex: 1 }} />
              <button className="btn btn-sm btn-primary" type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
            </form>
          )}

          {loading ? <div className="loading-row">Loading…</div> : rows.length === 0 ? (
            <div className="empty-state">No files attached yet.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rows.map((d) => (
                <li key={d.id} className="attachment-row">
                  <a href={d.file_path} target="_blank" rel="noreferrer">{d.file_name}</a>
                  <span className="attachment-row-meta">
                    <span className="muted" style={{ fontSize: 11.5 }}>{formatDateTime(d.uploaded_at)}</span>
                    {canEdit && <button className="btn btn-sm btn-danger" onClick={() => remove(d)}>Delete</button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
