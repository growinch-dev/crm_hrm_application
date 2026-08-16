import { useState } from 'react';
import FieldInput from './FieldInput';
import useEscapeToClose from '../hooks/useEscapeToClose';

export default function FormModal({ title, fields, initialData, onClose, onSubmit }) {
  const [values, setValues] = useState(() => {
    const base = {};
    fields.forEach((f) => { base[f.key] = initialData ? initialData[f.key] : (f.type === 'checkbox' ? false : ''); });
    return base;
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEscapeToClose(onClose);

  const setField = (key, val) => setValues((v) => ({ ...v, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    for (const f of fields) {
      if (f.required && (values[f.key] === '' || values[f.key] === null || values[f.key] === undefined)) {
        setError(`${f.label} is required.`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = { ...values };
      Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
      await onSubmit(payload);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong while saving.');
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            {fields.map((f) => (
              <div className="field" key={f.key}>
                <label>{f.label}{f.required && <span className="req"> *</span>}</label>
                <FieldInput field={f} value={values[f.key]} onChange={(val) => setField(f.key, val)} />
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
