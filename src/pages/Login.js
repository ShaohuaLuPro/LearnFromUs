import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Login({
  onLogin,
  onRegister,
  onRequestPasswordReset,
  onConfirmPasswordReset
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const resetToken = searchParams.get('resetToken') || '';
  const [mode, setMode] = useState(resetToken ? 'reset' : 'login');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetUrl, setResetUrl] = useState('');

  useEffect(() => {
    setMode(resetToken ? 'reset' : 'login');
    setError('');
    setNotice('');
    setResetUrl('');
  }, [resetToken]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const switchMode = (nextMode) => {
    if (nextMode !== 'reset' && resetToken) {
      setSearchParams({}, { replace: true });
    }
    setMode(nextMode);
    setError('');
    setNotice('');
    setResetUrl('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setResetUrl('');

    if (mode === 'forgot') {
      if (!form.email.trim()) {
        setError('Email is required.');
        return;
      }
      const result = await onRequestPasswordReset({ email: form.email });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(result.message || 'If that email exists, a reset link has been generated.');
      setResetUrl(result.resetUrl || '');
      return;
    }

    if (mode === 'reset') {
      if (!resetToken) {
        setError('Reset token is missing.');
        return;
      }
      if (!form.password.trim()) {
        setError('New password is required.');
        return;
      }
      if (form.password.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      const result = await onConfirmPasswordReset({ token: resetToken, newPassword: form.password });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(result.message || 'Password reset complete. You can now login.');
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      setSearchParams({}, { replace: true });
      setMode('login');
      return;
    }

    if (!form.email.trim() || !form.password.trim()) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'register' && !form.name.trim()) {
      setError('Display name is required.');
      return;
    }

    const action = mode === 'login' ? onLogin : onRegister;
    const result = await action(form);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate('/');
  };

  return (
    <div className="container page-shell">
      <div className="auth-shell">
        <section className="auth-card">
          <h2 className="section-title mb-2">
            {mode === 'login' && 'Welcome Back'}
            {mode === 'register' && 'Create Your Account'}
            {mode === 'forgot' && 'Reset Your Password'}
            {mode === 'reset' && 'Choose a New Password'}
          </h2>
          <p className="muted mb-4">
            {mode === 'login' && 'Join the forum to share coding hacks, showcase projects, and discuss ideas with other builders.'}
            {mode === 'register' && 'Create an account to publish posts, follow builders, and join the forum.'}
            {mode === 'forgot' && 'Enter your email and we will generate a secure password reset link.'}
            {mode === 'reset' && 'Set a new password for your account. This link expires automatically.'}
          </p>

          {(mode === 'login' || mode === 'register') && (
            <div className="mode-switch mb-4">
              <button
                type="button"
                className={`mode-btn ${mode === 'login' ? 'is-active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`mode-btn ${mode === 'register' ? 'is-active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Register
              </button>
            </div>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <button type="button" className="auth-inline-link mb-4" onClick={() => switchMode('login')}>
              Back to login
            </button>
          )}

          <form onSubmit={submit} className="forum-form">
            {mode === 'register' && (
              <div className="mb-3">
                <label className="form-label">Display Name</label>
                <input
                  className="form-control forum-input"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Your public name"
                />
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control forum-input"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <div className="mb-2">
                <label className="form-label">{mode === 'reset' ? 'New Password' : 'Password'}</label>
                <input
                  type="password"
                  className="form-control forum-input"
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  placeholder="At least 6 characters recommended"
                />
              </div>
            )}

            {mode === 'reset' && (
              <div className="mb-2">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-control forum-input"
                  value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  placeholder="Re-enter your new password"
                />
              </div>
            )}

            {mode === 'login' && (
              <div className="auth-inline-row mb-2">
                <button type="button" className="auth-inline-link" onClick={() => switchMode('forgot')}>
                  Forgot password?
                </button>
              </div>
            )}

            {notice && <p className="text-success mt-3 mb-0">{notice}</p>}
            {resetUrl && (
              <p className="mt-3 mb-0">
                <a className="auth-inline-link" href={resetUrl}>
                  Open reset link
                </a>
              </p>
            )}
            {error && <p className="text-danger mt-3 mb-0">{error}</p>}

            <button className="forum-primary-btn mt-4 w-100" type="submit">
              {mode === 'login' && 'Login'}
              {mode === 'register' && 'Create Account'}
              {mode === 'forgot' && 'Send Reset Link'}
              {mode === 'reset' && 'Save New Password'}
            </button>

            {mode === 'forgot' && (
              <p className="muted mt-3 mb-0">
                If SMTP is not configured, the reset link will be shown here for local development.
              </p>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
