import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Pill from '../components/Pill';
import ConfirmDialog from '../components/ConfirmDialog';
import PasswordInput from '../components/PasswordInput';
import useEscapeToClose from '../hooks/useEscapeToClose';
import { useAuth } from '../context/AuthContext';

function NewOrganizationForm({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [enabledCrm, setEnabledCrm] = useState(true);
  const [enabledHrm, setEnabledHrm] = useState(true);
  const [enabledAccounts, setEnabledAccounts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const logoRef = useRef(null);

  useEscapeToClose(onClose);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email_domain', emailDomain);
      formData.append('admin_name', adminName);
      formData.append('admin_email', adminEmail);
      formData.append('admin_password', adminPassword);
      formData.append('enabled_crm', enabledCrm);
      formData.append('enabled_hrm', enabledHrm);
      formData.append('enabled_accounts', enabledAccounts);
      if (logoRef.current.files[0]) formData.append('logo', logoRef.current.files[0]);
      await api.post('/platform/organizations', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create organization.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: 480 }}>
        <div className="modal-header"><h3>New Organization</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="field">
              <label>Company Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Email Domain</label>
              <input
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value)}
                placeholder="e.g. acme.com"
                required
              />
              <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                Anyone logging in with an email ending in this domain routes to this company's own database.
              </div>
            </div>
            <div className="field">
              <label>Company Logo (optional)</label>
              <input type="file" ref={logoRef} accept="image/*" />
              <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                Shown in place of the GrowInch mark once this company's users log in.
              </div>
            </div>
            <div className="section-title" style={{ marginTop: 16 }}>First Admin Account</div>
            <div className="field-row">
              <div className="field"><label>Admin Name</label><input value={adminName} onChange={(e) => setAdminName(e.target.value)} required /></div>
              <div className="field"><label>Admin Email</label><input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required /></div>
            </div>
            <div className="field">
              <label>Admin Password</label>
              <PasswordInput value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div className="section-title" style={{ marginTop: 16 }}>Enabled Modules</div>
            <div className="field-check"><input type="checkbox" checked={enabledCrm} onChange={(e) => setEnabledCrm(e.target.checked)} /><span>CRM</span></div>
            <div className="field-check"><input type="checkbox" checked={enabledHrm} onChange={(e) => setEnabledHrm(e.target.checked)} /><span>HRM</span></div>
            <div className="field-check"><input type="checkbox" checked={enabledAccounts} onChange={(e) => setEnabledAccounts(e.target.checked)} /><span>Accounts</span></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Organization'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditOrganizationForm({ org, onClose, onSaved }) {
  const [name, setName] = useState(org.name);
  const [emailDomain, setEmailDomain] = useState(org.email_domain);
  const [enabledCrm, setEnabledCrm] = useState(org.enabled_crm);
  const [enabledHrm, setEnabledHrm] = useState(org.enabled_hrm);
  const [enabledAccounts, setEnabledAccounts] = useState(org.enabled_accounts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const logoRef = useRef(null);

  useEscapeToClose(onClose);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email_domain', emailDomain);
      formData.append('enabled_crm', enabledCrm);
      formData.append('enabled_hrm', enabledHrm);
      formData.append('enabled_accounts', enabledAccounts);
      if (logoRef.current.files[0]) formData.append('logo', logoRef.current.files[0]);
      await api.put(`/platform/organizations/${org.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update organization.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: 480 }}>
        <div className="modal-header"><h3>Edit {org.name}</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="field">
              <label>Company Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Email Domain</label>
              <input value={emailDomain} onChange={(e) => setEmailDomain(e.target.value)} required />
              <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                Changing this immediately affects which company future logins for this domain route to.
              </div>
            </div>
            <div className="field">
              <label>Company Logo</label>
              {org.logo_path && (
                <img src={org.logo_path} alt={org.name} style={{ height: 32, marginBottom: 8, background: '#fff', padding: '4px 8px', borderRadius: 6, display: 'block' }} />
              )}
              <input type="file" ref={logoRef} accept="image/*" />
            </div>
            <div className="section-title" style={{ marginTop: 16 }}>Enabled Modules</div>
            <div className="field-check"><input type="checkbox" checked={enabledCrm} onChange={(e) => setEnabledCrm(e.target.checked)} /><span>CRM</span></div>
            <div className="field-check"><input type="checkbox" checked={enabledHrm} onChange={(e) => setEnabledHrm(e.target.checked)} /><span>HRM</span></div>
            <div className="field-check"><input type="checkbox" checked={enabledAccounts} onChange={(e) => setEnabledAccounts(e.target.checked)} /><span>Accounts</span></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PlatformDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [deletingOrg, setDeletingOrg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/platform/organizations');
    setRows(res.data.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (org) => {
    await api.put(`/platform/organizations/${org.id}`, { status: org.status === 'active' ? 'suspended' : 'active' });
    load();
  };

  const deleteOrg = async () => {
    await api.delete(`/platform/organizations/${deletingOrg.id}`);
    setDeletingOrg(null);
    load();
  };

  return (
    <div className="app-shell">
      <div className="main-col" style={{ width: '100%' }}>
        <div className="topbar">
          <div className="topbar-crumb">GROWINCH PLATFORM ADMIN</div>
          <div className="topbar-user">
            <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
          </div>
        </div>

        <div className="content">
          <div className="page-header">
            <div><h1>Organizations</h1><p className="desc">Onboard new companies onto the GrowInch platform and control their enabled modules.</p></div>
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>+ New Organization</button>
          </div>

          {loading ? <div className="loading-row">Loading…</div> : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Logo</th><th>Name</th><th>Email Domain</th><th>CRM</th><th>HRM</th><th>Accounts</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {o.logo_path ? (
                          <img src={o.logo_path} alt={o.name} style={{ height: 24, background: '#fff', padding: '3px 6px', borderRadius: 4 }} />
                        ) : <span className="faint">—</span>}
                      </td>
                      <td>
                        {o.name}
                        {!o.db_exists && (
                          <div style={{ marginTop: 3 }}>
                            <Pill value="database missing" colorMap={{ 'database missing': 'red' }} />
                          </div>
                        )}
                      </td>
                      <td className="mono">{o.email_domain}</td>
                      <td><Pill value={o.enabled_crm ? 'yes' : 'no'} colorMap={{ yes: 'green', no: 'gray' }} /></td>
                      <td><Pill value={o.enabled_hrm ? 'yes' : 'no'} colorMap={{ yes: 'green', no: 'gray' }} /></td>
                      <td><Pill value={o.enabled_accounts ? 'yes' : 'no'} colorMap={{ yes: 'green', no: 'gray' }} /></td>
                      <td><Pill value={o.status} colorMap={{ active: 'green', suspended: 'red' }} /></td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditingOrg(o)}>Edit</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => toggleStatus(o)}>
                            {o.status === 'active' ? 'Suspend' : 'Reactivate'}
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => setDeletingOrg(o)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={8} className="empty-state">No organizations yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createOpen && <NewOrganizationForm onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load(); }} />}
      {editingOrg && (
        <EditOrganizationForm
          org={editingOrg}
          onClose={() => setEditingOrg(null)}
          onSaved={() => { setEditingOrg(null); load(); }}
        />
      )}
      {deletingOrg && (
        <ConfirmDialog
          title={`Delete ${deletingOrg.name}?`}
          message={
            deletingOrg.db_exists
              ? `This permanently deletes the organization and its entire database, including all its users, leads, employees and records. This can't be undone.`
              : `This organization's database no longer exists on the server. This just removes the leftover record so it stops appearing here.`
          }
          confirmLabel="Delete"
          onConfirm={deleteOrg}
          onCancel={() => setDeletingOrg(null)}
        />
      )}
    </div>
  );
}
