import { useAuth } from '../context/AuthContext';

// Whether the current user's role allows create/edit/delete anywhere in the app.
// Mirrors the server-side check in middleware/auth.js's requireEdit - this hook only
// controls what's shown in the UI; the API rejects mutations independently either way.
export default function useCanEdit() {
  const { user } = useAuth();
  return user?.can_edit !== false;
}
