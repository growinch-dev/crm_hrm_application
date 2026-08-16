import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import Pill from '../components/Pill';
import PasswordInput from '../components/PasswordInput';
import useEscapeToClose from '../hooks/useEscapeToClose';
import useCanEdit from '../hooks/useCanEdit';

export default function Users() {
  const canEdit = useCanEdit();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee' });
  const [error, setError] = useState('');

  useEscapeToClose(() => setCreateOpen(false));

  const load = useCallback(async () => {
    setLoading(true);
    const [u, r] = await Promise.all([api.get('/users'), api.get('/meta/roles')]);
    setRows(u.data.data);
    setRoles(r.data.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (u) => {
    await api.put(`/users/${u.id}`, { is_active: !u.is_active });
    load();
  };

  const changeRole = async (u, roleId) => {
    await api.put(`/users/${u.id}`, { role_id: Number(roleId) });
    load();
  };

  const createUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', form);
      setCreateOpen(false);
      setForm({ name: '', email: '', password: '', role: 'employee' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user.');
    }
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1>Users</h1><p className="desc">Login accounts and role assignments.</p></div>
        {canEdit && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>+ New User</button>}
      </div>

      {loading ? <div className="loading-row">Loading…</div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    {canEdit ? (
                      <select value={u.role_id || ''} onChange={(e) => changeRole(u, e.target.value)} style={{ padding: '5px 8px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border-2)' }}>
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    ) : (roles.find((r) => r.id === u.role_id)?.name || '—')}
                  </td>
                  <td><Pill value={u.is_active ? 'active' : 'inactive'} /></td>
                  <td><div className="row-actions">{canEdit && <button className="btn btn-sm btn-secondary" onClick={() => toggleActive(u)}>{u.is_active ? 'Deactivate' : 'Activate'}</button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setCreateOpen(false)}>
          <div className="modal-panel">
            <div className="modal-header"><h3>New User</h3><button className="btn btn-ghost btn-sm" onClick={() => setCreateOpen(false)}>✕</button></div>
            <form onSubmit={createUser}>
              <div className="modal-body">
                {error && <div className="form-error">{error}</div>}
                <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
                <div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required /></div>
                <div className="field"><label>Password</label><PasswordInput value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required autoComplete="new-password" /></div>
                <div className="field">
                  <label>Role</label>
                  <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                    {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
