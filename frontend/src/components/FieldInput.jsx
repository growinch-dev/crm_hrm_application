import { useEffect, useState } from 'react';
import api from '../api/client';

export default function FieldInput({ field, value, onChange }) {
  const [options, setOptions] = useState(field.options || []);
  const [loadingOptions, setLoadingOptions] = useState(field.type === 'select-async');

  useEffect(() => {
    let cancelled = false;
    if (field.type === 'select-async' && field.optionsEndpoint) {
      setLoadingOptions(true);
      api.get(field.optionsEndpoint, { params: { limit: 500 } })
        .then((res) => {
          if (cancelled) return;
          const rows = res.data.data || res.data || [];
          setOptions(rows);
        })
        .catch(() => !cancelled && setOptions([]))
        .finally(() => !cancelled && setLoadingOptions(false));
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.optionsEndpoint]);

  const labelKey = field.optionsLabel || 'name';

  if (field.type === 'textarea') {
    return <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />;
  }

  if (field.type === 'checkbox') {
    return (
      <div className="field-check">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span className="muted" style={{ fontSize: 13 }}>{field.checkLabel || 'Yes'}</span>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'select-async') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}>
        <option value="">{loadingOptions ? 'Loading…' : 'Select…'}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt[labelKey] || opt.name || opt.title || `#${opt.id}`}
            {opt.last_name ? ` ${opt.last_name}` : ''}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'date' || field.type === 'time') {
    return (
      <input
        type={field.type}
        value={value ? String(value).slice(0, field.type === 'date' ? 10 : 5) : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
      value={value ?? ''}
      placeholder={field.placeholder}
      onChange={(e) => onChange(field.type === 'number' ? e.target.value : e.target.value)}
    />
  );
}
