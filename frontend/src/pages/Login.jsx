import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import growinchLogo from '../assets/growinch-logo.png';

export default function Login() {
  const { user, login, error, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) navigate('/');
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img src={growinchLogo} alt="GrowInch" className="login-logo" />
        </div>
        <div className="login-title">Sign in</div>
        <div className="login-sub">CRM + HRM &middot; one workspace for sales and people operations.</div>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <Link to="/forgot-password" className="login-forgot">Forgot password?</Link>
          <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-footer">This software belongs to GrowInch Technologies Pvt Ltd.</div>
      </div>
    </div>
  );
}
