import useEscapeToClose from '../hooks/useEscapeToClose';

export default function ConfirmDialog({ title, message, error, confirmLabel = 'Confirm', danger = true, onConfirm, onCancel }) {
  useEscapeToClose(onCancel);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-panel" style={{ maxWidth: 420 }}>
        <div className="modal-header"><h3>{title}</h3></div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
