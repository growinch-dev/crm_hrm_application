import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guards the regular CRM/HRM/Accounts/Settings app shell. Platform admins have no
// organization to view here - they're bounced to their own dashboard instead.
export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.is_platform_admin) return <Navigate to="/platform" replace />;
  return children;
}

// Guards the platform-admin-only area. Regular org users are bounced back to the app.
export function PlatformProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_platform_admin) return <Navigate to="/" replace />;
  return children;
}
