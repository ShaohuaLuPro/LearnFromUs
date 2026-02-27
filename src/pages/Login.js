import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login({ onLogin, onRegister }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

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
          <h2 className="section-title mb-2">{mode === 'login' ? 'Welcome Back' : 'Create Your Account'}</h2>
          <p className="muted mb-4">
            Join the forum to share coding hacks, showcase projects, and discuss ideas with other builders.
          </p>

          <div className="mode-switch mb-4">
            <button
              type="button"
              className={`mode-btn ${mode === 'login' ? 'is-active' : ''}`}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'register' ? 'is-active' : ''}`}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>

          <form onSubmit={submit} className="forum-form">
            {mode === 'register' && (
              <div className="mb-3">
                <label className="form-label">Display Name</label>
                <input
                  className="form-control forum-input"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Your public name"
                />
              </div>
            )}

            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control forum-input"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="name@example.com"
              />
            </div>

            <div className="mb-2">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control forum-input"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="At least 6 characters recommended"
              />
            </div>

            {error && <p className="text-danger mt-3 mb-0">{error}</p>}

            <button className="forum-primary-btn mt-4 w-100" type="submit">
              {mode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
