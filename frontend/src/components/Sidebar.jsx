import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Circle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CRM_MODULES, CRM_CUSTOM_PAGES } from '../config/crmModules';
import { HRM_MODULES, HRM_CUSTOM_PAGES } from '../config/hrmModules';
import { SETTINGS_MODULES } from '../config/settingsModules';
import { ACCOUNTS_MODULES, ACCOUNTS_CUSTOM_PAGES } from '../config/accountsModules';
import { SIDEBAR_ICONS } from '../config/sidebarIcons';
import growinchLogo from '../assets/growinch-logo.png';

const crmItems = [...CRM_MODULES, ...CRM_CUSTOM_PAGES].sort((a, b) => a.num - b.num);
const hrmItems = [...HRM_MODULES, ...HRM_CUSTOM_PAGES].sort((a, b) => a.num - b.num);
const accountsItems = [...ACCOUNTS_MODULES, ...ACCOUNTS_CUSTOM_PAGES].sort((a, b) => a.num - b.num);

function NavItem({ to, itemKey, label, onNavigate }) {
  const Icon = SIDEBAR_ICONS[itemKey] || Circle;
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onNavigate}>
      <Icon size={16} strokeWidth={2} className="sidebar-link-icon" />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  // `!== false` keeps legacy tokens (issued before these fields existed) showing everything, non-breaking.
  // Visibility requires BOTH the role's own flag AND the organization's platform-controlled entitlement.
  const sections = [
    { key: 'crm', label: 'CRM', items: crmItems, visible: user?.can_access_crm !== false && user?.org_enabled_crm !== false },
    { key: 'hrm', label: 'HRM', items: hrmItems, visible: user?.can_access_hrm !== false && user?.org_enabled_hrm !== false },
    { key: 'accounts', label: 'Accounts', items: accountsItems, visible: user?.can_access_accounts !== false && user?.org_enabled_accounts !== false },
  ];
  const visibleSections = sections.filter((s) => s.visible);
  const [active, setActive] = useState(visibleSections[0]?.key);
  const activeSection = visibleSections.find((s) => s.key === active) || visibleSections[0];

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-brand">
        {user?.organization_logo ? (
          <img src={user.organization_logo} alt={user.organization_name} className="sidebar-org-logo" />
        ) : (
          <img src={growinchLogo} alt="GrowInch" className="sidebar-logo" />
        )}
        <div className="sidebar-brand-sub">{user?.organization_name || 'CRM + HRM Suite'}</div>
      </div>

      {visibleSections.length > 1 && (
        <div className="sidebar-switcher">
          {visibleSections.map((s) => (
            <button key={s.key} type="button" className={activeSection?.key === s.key ? 'active' : ''} onClick={() => setActive(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {activeSection && (
        <div className="sidebar-group">
          <div className="sidebar-group-label">{activeSection.label}</div>
          {activeSection.items.map((m) => (
            <NavItem key={m.key} to={m.path} itemKey={m.key} label={m.pipelineLabel ? m.pipelineLabel : m.label} onNavigate={onClose} />
          ))}
        </div>
      )}

      <div className="sidebar-group">
        <div className="sidebar-group-label">Settings</div>
        {SETTINGS_MODULES.map((m) => (
          <NavItem key={m.key} to={m.path} itemKey={m.key} label={m.label} onNavigate={onClose} />
        ))}
        <NavItem to="/settings/users" itemKey="users" label="Users" onNavigate={onClose} />
        <NavItem to="/settings/company-documents" itemKey="company-documents" label="Company Documents" onNavigate={onClose} />
      </div>

      <div className="sidebar-footer">
        {user?.organization_logo ? 'Powered by GrowInch Technologies Pvt Ltd.' : '© GrowInch Technologies Pvt Ltd. All rights reserved.'}
      </div>
    </aside>
  );
}
