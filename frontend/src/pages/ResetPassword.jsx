import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import growinchLogo from '../assets/growinch-logo.png';

export default function ResetPassword() {
  const { resetPassword, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setResult({ ok: false, message: 'Passwords do not match.' });
      return;
    }
    const res = await resetPassword(token, email, password);
    setResult(res);
    if (res.ok) setTimeout(() => navigate('/login'), 2000);
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img src={growinchLogo} alt="GrowInch" className="login-logo" />
        </div>
        <div className="login-title">Reset password</div>
        <div className="login-sub">Choose a new password for your account.</div>

        {(!token || !email) && <div className="form-error">This reset link is incomplete. Request a new one.</div>}

        {result && <div className={result.ok ? 'login-hint' : 'form-error'}>{result.message}</div>}

        {token && email && !result?.ok && (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>New Password</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div className="field">
              <label>Confirm New Password</label>
              <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}

        <div className="login-footer">
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
