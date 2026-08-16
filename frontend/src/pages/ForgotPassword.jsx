import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import growinchLogo from '../assets/growinch-logo.png';

export default function ForgotPassword() {
  const { forgotPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await forgotPassword(email);
    setResult(res);
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img src={growinchLogo} alt="GrowInch" className="login-logo" />
        </div>
        <div className="login-title">Forgot password</div>
        <div className="login-sub">Enter your account email and we'll send you a reset link.</div>

        {result ? (
          <div className={result.ok ? 'login-hint' : 'form-error'}>{result.message}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
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
