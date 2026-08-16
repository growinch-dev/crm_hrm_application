import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}
      <div className="main-col">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button className="btn btn-ghost btn-sm sidebar-toggle" onClick={() => setSidebarOpen((o) => !o)} aria-label="Toggle menu">☰</button>
            <div className="topbar-crumb">{user?.organization_name || 'CRM + HRM SUITE'}</div>
          </div>
          <div className="topbar-user">
            <NotificationBell />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
              <div className="topbar-role">{user?.role?.replace(/_/g, ' ')}</div>
            </div>
            <div className="topbar-avatar">{initials(user?.name)}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
