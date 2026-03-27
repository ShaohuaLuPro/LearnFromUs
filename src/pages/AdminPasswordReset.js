import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAdminResetUserPassword } from '../api';
import { authStorage } from '../lib/authStorage';

export default function AdminPasswordReset() {
  const [identifier, setIdentifier] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const token = authStorage.getToken();
    if (!token) {
      setNotice({ type: 'error', text: 'Please login first.' });
      return;
    }

    setSubmitting(true);
    setNotice({ type: '', text: '' });
    try {
      const response = await apiAdminResetUserPassword({
        identifier,
        newPassword: passwordValue
      }, token);
      setIdentifier('');
      setPasswordValue('');
      setShowPassword(false);
      setNotice({ type: 'success', text: response.message || 'Temporary password updated.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update password.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container page-shell my-forums-page">
      <section className="panel my-forums-panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-1">Admin</p>
            <h2 className="mb-1 type-title-md">Set Temporary Password</h2>
            <p className="muted mb-0">
              Admins with password reset access can set a temporary password for any user. This changes the password immediately, but does not reveal the old one.
            </p>
          </div>
          <Link to="/admin/access" className="forum-secondary-btn text-decoration-none">
            Back to Access
          </Link>
        </div>

        <form className="forum-admin-create-form" onSubmit={handleSubmit}>
          <label className="w-100">
            <span className="form-label">User</span>
            <input
              className="form-control forum-input"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="username, email, or user id"
              disabled={submitting}
            />
          </label>
          <label className="w-100">
            <span className="form-label">Temporary Password</span>
            <div className="password-input-shell">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control forum-input password-input"
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
                placeholder="At least 8 characters"
                disabled={submitting}
              />
              <button
                type="button"
                className="password-visibility-btn"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide temporary password' : 'Show temporary password'}
                aria-pressed={showPassword}
                disabled={submitting}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          <button
            type="submit"
            className="forum-primary-btn"
            disabled={!identifier.trim() || passwordValue.length < 8 || submitting}
          >
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
          {notice.text && (
            <div className={`settings-alert ${notice.type === 'error' ? 'is-error' : 'is-success'}`}>
              {notice.text}
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
