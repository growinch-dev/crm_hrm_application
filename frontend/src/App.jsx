import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute, { PlatformProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import GenericListPage from './pages/GenericListPage';

import { CRM_MODULES } from './config/crmModules';
import { HRM_MODULES } from './config/hrmModules';
import { SETTINGS_MODULES } from './config/settingsModules';
import { ACCOUNTS_MODULES } from './config/accountsModules';

import CrmDashboard from './pages/CrmDashboard';
import HrmDashboard from './pages/HrmDashboard';
import DealsPipeline from './pages/DealsPipeline';
import Quotations from './pages/Quotations';
import SalesOrders from './pages/SalesOrders';
import Tickets from './pages/Tickets';
import Payroll from './pages/Payroll';
import Documents from './pages/Documents';
import Users from './pages/Users';
import Invoices from './pages/Invoices';
import Payments from './pages/Payments';
import CompanyExpenses from './pages/CompanyExpenses';
import Ledger from './pages/Ledger';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PlatformDashboard from './pages/PlatformDashboard';

function DefaultRedirect() {
  const { user } = useAuth();
  const canCrm = user?.can_access_crm !== false && user?.org_enabled_crm !== false;
  const canHrm = user?.can_access_hrm !== false && user?.org_enabled_hrm !== false;
  const canAccounts = user?.can_access_accounts !== false && user?.org_enabled_accounts !== false;
  const target = canCrm ? '/crm/dashboard' : canHrm ? '/hrm/dashboard' : canAccounts ? '/accounts/ledger-page' : '/settings/users';
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/platform" element={<PlatformProtectedRoute><PlatformDashboard /></PlatformProtectedRoute>} />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DefaultRedirect />} />

            {/* ---- CRM: generic config-driven modules ---- */}
            {CRM_MODULES.map((m) => (
              <Route key={m.key} path={m.path.replace(/^\//, '')} element={<GenericListPage module={m} />} />
            ))}
            {/* ---- CRM: custom modules ---- */}
            <Route path="crm/dashboard" element={<CrmDashboard />} />
            <Route path="crm/deals-pipeline" element={<DealsPipeline />} />
            <Route path="crm/quotations-page" element={<Quotations />} />
            <Route path="crm/sales-orders-page" element={<SalesOrders />} />
            <Route path="crm/tickets-page" element={<Tickets />} />
            <Route path="crm/documents-page" element={<Documents scope="crm" />} />

            {/* ---- HRM: generic config-driven modules ---- */}
            {HRM_MODULES.map((m) => (
              <Route key={m.key} path={m.path.replace(/^\//, '')} element={<GenericListPage module={m} />} />
            ))}
            {/* ---- HRM: custom modules ---- */}
            <Route path="hrm/dashboard" element={<HrmDashboard />} />
            <Route path="hrm/payroll-page" element={<Payroll />} />
            <Route path="hrm/documents-page" element={<Documents scope="hrm" />} />

            {/* ---- Accounts: generic config-driven modules ---- */}
            {ACCOUNTS_MODULES.map((m) => (
              <Route key={m.key} path={m.path.replace(/^\//, '')} element={<GenericListPage module={m} />} />
            ))}
            {/* ---- Accounts: custom modules ---- */}
            <Route path="accounts/invoices-page" element={<Invoices />} />
            <Route path="accounts/payments-page" element={<Payments />} />
            <Route path="accounts/expenses-page" element={<CompanyExpenses />} />
            <Route path="accounts/ledger-page" element={<Ledger />} />

            {/* ---- Settings / master data ---- */}
            {SETTINGS_MODULES.map((m) => (
              <Route key={m.key} path={m.path.replace(/^\//, '')} element={<GenericListPage module={m} />} />
            ))}
            <Route path="settings/users" element={<Users />} />
            <Route path="settings/company-documents" element={<Documents scope="company" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
