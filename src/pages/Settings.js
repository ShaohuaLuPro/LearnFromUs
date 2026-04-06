import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiUploadMediaFile } from '../api';
import { authStorage } from '../lib/authStorage';

function getUserAvatarInitial(name) {
  const cleanName = String(name || '').trim();
  return cleanName ? cleanName.slice(0, 1).toUpperCase() : 'T';
}

export default function Settings({ currentUser, onUpdateProfile, onUpdatePassword, onDeleteAccount }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(currentUser?.avatarUrl || '');
  const [avatarAssetId, setAvatarAssetId] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMarkedForRemoval, setAvatarMarkedForRemoval] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const profileRef = useRef(null);
  const passwordRef = useRef(null);
  const dangerRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    setProfileName(currentUser?.name || '');
    setAvatarPreviewUrl(currentUser?.avatarUrl || '');
    setAvatarAssetId('');
    setAvatarMarkedForRemoval(false);
  }, [currentUser?.name, currentUser?.avatarUrl]);

  useEffect(() => {
    const panel = searchParams.get('panel');
    const targetMap = {
      profile: profileRef.current,
      password: passwordRef.current,
      danger: dangerRef.current
    };
    const target = targetMap[panel || ''];
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams]);

  const submitProfile = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const result = await onUpdateProfile({
      name: profileName,
      avatarAssetId: avatarAssetId || undefined,
      removeAvatar: avatarMarkedForRemoval
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setAvatarPreviewUrl(result.user?.avatarUrl || '');
    setAvatarAssetId('');
    setAvatarMarkedForRemoval(false);
    setMessage('Profile updated.');
  };

  const openAvatarPicker = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    const token = authStorage.getToken();
    if (!token) {
      setError('Login expired. Please sign in again before uploading.');
      return;
    }

    setAvatarUploading(true);
    setError('');
    setMessage('');
    try {
      const asset = await apiUploadMediaFile(file, token, { visibility: 'public' });
      setAvatarPreviewUrl(asset.url);
      setAvatarAssetId(asset.id);
      setAvatarMarkedForRemoval(false);
      setMessage('Avatar uploaded. Save profile to apply it.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload avatar.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = () => {
    setAvatarPreviewUrl('');
    setAvatarAssetId('');
    setAvatarMarkedForRemoval(true);
    setMessage('Avatar removed. Save profile to apply it.');
    setError('');
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
            <section
              ref={profileRef}
              className={`settings-card ${searchParams.get('panel') === 'profile' ? 'is-focused' : ''}`}
            >
              <h4 className="mb-3">Profile</h4>
              <form onSubmit={submitProfile} className="forum-form">
                <div className="mb-3">
                  <label className="form-label">Avatar</label>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    className="d-none"
                    onChange={handleAvatarSelected}
                  />
                  <div className="settings-avatar-row">
                    {avatarPreviewUrl ? (
                      <img src={avatarPreviewUrl} alt={profileName || 'Your avatar'} className="settings-avatar-preview" />
                    ) : (
                      <div className="settings-avatar-fallback">
                        {getUserAvatarInitial(profileName || currentUser?.name)}
                      </div>
                    )}
                    <div className="settings-avatar-actions">
                      <button
                        type="button"
                        className="forum-secondary-btn"
                        onClick={openAvatarPicker}
                        disabled={avatarUploading}
                      >
                        {avatarUploading ? 'Uploading...' : avatarPreviewUrl ? 'Change Avatar' : 'Upload Avatar'}
                      </button>
                      {(avatarPreviewUrl || currentUser?.avatarUrl) && (
                        <button type="button" className="forum-danger-btn" onClick={removeAvatar}>
                          Remove Avatar
                        </button>
                      )}
                      <div className="form-help">Use a square or close-up image for the best result.</div>
                    </div>
                  </div>
                </div>
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
            <section
              ref={passwordRef}
              className={`settings-card ${searchParams.get('panel') === 'password' ? 'is-focused' : ''}`}
            >
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

        <section
          ref={dangerRef}
          className={`settings-card settings-danger-card mt-4 ${searchParams.get('panel') === 'danger' ? 'is-focused' : ''}`}
        >
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
