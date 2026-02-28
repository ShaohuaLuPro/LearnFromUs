import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Settings({ currentUser, onUpdateProfile, onUpdatePassword, onDeleteAccount }) {
  const navigate = useNavigate();
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submitProfile = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const result = await onUpdateProfile({ name: profileName });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage('Profile updated.');
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const result = await onUpdatePassword(passwordForm);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPasswordForm({ currentPassword: '', newPassword: '' });
    setMessage('Password updated.');
  };

  const deleteAccount = async () => {
    setError('');
    setMessage('');
    if (deleteConfirm.trim().toLowerCase() !== 'delete') {
      setError('Type "delete" to confirm account removal.');
      return;
    }
    const result = await onDeleteAccount();
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate('/goodbye', { replace: true });
  };

  return (
    <div className="container page-shell">
      <section className="panel settings-shell">
        <div className="settings-header">
          <div>
            <p className="type-kicker mb-2">Account</p>
            <h2 className="mb-2 type-title-md">Settings</h2>
            <p className="type-body mb-0">Manage your profile, password, and account access.</p>
          </div>
        </div>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'}`}>
            {error || message}
          </div>
        )}

        <div className="row g-4">
          <div className="col-lg-6">
            <section className="settings-card">
              <h4 className="mb-3">Profile</h4>
              <form onSubmit={submitProfile} className="forum-form">
                <div className="mb-3">
                  <label className="form-label">Display Name</label>
                  <input
                    className="form-control forum-input"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input className="form-control forum-input" value={currentUser?.email || ''} disabled />
                </div>
                <button type="submit" className="forum-primary-btn">Save Profile</button>
              </form>
            </section>
          </div>

          <div className="col-lg-6">
            <section className="settings-card">
              <h4 className="mb-3">Password</h4>
              <form onSubmit={submitPassword} className="forum-form">
                <div className="mb-3">
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    className="form-control forum-input"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-control forum-input"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  />
                </div>
                <button type="submit" className="forum-primary-btn">Update Password</button>
              </form>
            </section>
          </div>
        </div>

        <section className="settings-card settings-danger-card mt-4">
          <h4 className="mb-2 type-title-md">Danger Zone</h4>
          <p className="type-body mb-3">Deleting your account also removes your posts and associated activity.</p>
          <div className="mb-3">
            <label className="form-label type-label">Type "delete" to confirm</label>
            <input
              className="form-control forum-input"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="delete"
            />
          </div>
          <button type="button" className="forum-danger-btn" onClick={deleteAccount}>Delete Account</button>
        </section>
      </section>
    </div>
  );
}
