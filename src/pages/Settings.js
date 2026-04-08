import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiUploadMediaFile, resolveMediaSource } from '../api';
import Avatar from '../components/Avatar';
import { authStorage } from '../lib/authStorage';

const PROFILE_BIO_MAX_LENGTH = 280;

function deriveHandle(name = '') {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);
  return base ? `@${base}` : '@user';
}

export default function Settings({ currentUser, onUpdateProfile, onUpdatePassword, onDeleteAccount }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileBio, setProfileBio] = useState(currentUser?.bio || '');
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
    setProfileBio(currentUser?.bio || '');
    setAvatarPreviewUrl(currentUser?.avatarUrl || '');
    setAvatarAssetId('');
    setAvatarMarkedForRemoval(false);
  }, [currentUser?.name, currentUser?.bio, currentUser?.avatarUrl]);

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

  const hasProfileChanges = useMemo(() => {
    return (
      profileName.trim() !== String(currentUser?.name || '').trim()
      || profileBio.trim() !== String(currentUser?.bio || '').trim()
      || Boolean(avatarAssetId)
      || Boolean(avatarMarkedForRemoval)
    );
  }, [avatarAssetId, avatarMarkedForRemoval, currentUser?.bio, currentUser?.name, profileBio, profileName]);

  const submitProfile = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!profileName.trim()) {
      setError('Display name is required.');
      return;
    }

    if (profileBio.trim().length > PROFILE_BIO_MAX_LENGTH) {
      setError(`Bio must be ${PROFILE_BIO_MAX_LENGTH} characters or fewer.`);
      return;
    }

    const result = await onUpdateProfile({
      name: profileName.trim(),
      bio: profileBio.trim(),
      avatarAssetId: avatarAssetId || undefined,
      removeAvatar: avatarMarkedForRemoval
    });

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setProfileName(result.user?.name || profileName.trim());
    setProfileBio(result.user?.bio || profileBio.trim());
    setAvatarPreviewUrl(result.user?.avatarUrl || '');
    setAvatarAssetId('');
    setAvatarMarkedForRemoval(false);
    setMessage('Profile updated.');
  };

  const resetProfileDraft = () => {
    setProfileName(currentUser?.name || '');
    setProfileBio(currentUser?.bio || '');
    setAvatarPreviewUrl(currentUser?.avatarUrl || '');
    setAvatarAssetId('');
    setAvatarMarkedForRemoval(false);
    setMessage('');
    setError('');
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
      setAvatarPreviewUrl(resolveMediaSource(asset.url));
      setAvatarAssetId(asset.id);
      setAvatarMarkedForRemoval(false);
      setMessage('Avatar uploaded. Save changes to publish it.');
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
    setMessage('Avatar removed. Save changes to apply.');
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

  const previewName = profileName.trim() || currentUser?.name || 'Your name';
  const previewBio = profileBio.trim() || 'Add a short bio so people know what you build and care about.';
  const previewHandle = deriveHandle(previewName);

  return (
    <div className="container page-shell">
      <section className="panel settings-shell">
        <header className="settings-page-header">
          <div>
            <p className="type-kicker mb-1">Profile</p>
            <h1 className="settings-page-title mb-1">Profile Settings</h1>
            <p className="settings-page-subtitle mb-0">Manage how you appear across the platform.</p>
          </div>
        </header>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'}`}>
            {error || message}
          </div>
        )}

        <section
          ref={profileRef}
          className={`settings-card settings-profile-card ${searchParams.get('panel') === 'profile' ? 'is-focused' : ''}`.trim()}
        >
          <div className="settings-profile-card-head">
            <div>
              <h2 className="settings-panel-title mb-1">Edit Profile</h2>
              <p className="settings-panel-copy mb-0">Update your public identity, introduction, and avatar.</p>
            </div>
          </div>

          <div className="settings-profile-grid">
            <form onSubmit={submitProfile} className="settings-profile-form">
              <section className="settings-profile-section">
                <div>
                  <h3 className="settings-section-title mb-1">Profile Photo</h3>
                  <p className="settings-section-copy mb-0">Upload a clear avatar for better recognition across posts and comments.</p>
                </div>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="d-none"
                  onChange={handleAvatarSelected}
                />

                <div className="settings-avatar-editor">
                  <Avatar
                    imageUrl={avatarPreviewUrl}
                    name={previewName}
                    size={88}
                    className="settings-avatar-media"
                  />
                  <div className="settings-avatar-buttons">
                    <button
                      type="button"
                      className="forum-secondary-btn"
                      onClick={openAvatarPicker}
                      disabled={avatarUploading}
                    >
                      {avatarUploading ? 'Uploading...' : avatarPreviewUrl ? 'Change Avatar' : 'Upload Avatar'}
                    </button>
                    {(avatarPreviewUrl || currentUser?.avatarUrl) ? (
                      <button type="button" className="forum-secondary-btn settings-avatar-remove-btn" onClick={removeAvatar}>
                        Remove
                      </button>
                    ) : null}
                    <p className="form-help mb-0">Square image recommended. JPG, PNG, WEBP, GIF, or AVIF.</p>
                  </div>
                </div>
              </section>

              <section className="settings-profile-section">
                <div>
                  <h3 className="settings-section-title mb-1">Basic Info</h3>
                  <p className="settings-section-copy mb-0">This information appears on your public profile.</p>
                </div>

                <label>
                  <span className="form-label">Display Name</span>
                  <input
                    className="form-control forum-input"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    maxLength={80}
                    placeholder="Your display name"
                  />
                </label>

                <label>
                  <span className="form-label">Bio / Introduction</span>
                  <textarea
                    className="form-control forum-input settings-profile-bio-input"
                    value={profileBio}
                    onChange={(event) => setProfileBio(event.target.value)}
                    maxLength={PROFILE_BIO_MAX_LENGTH}
                    rows={4}
                    placeholder="Tell people what you create, learn, or share."
                  />
                  <span className="settings-input-meta">
                    {profileBio.trim().length}/{PROFILE_BIO_MAX_LENGTH}
                  </span>
                </label>

                <label>
                  <span className="form-label">Email</span>
                  <input className="form-control forum-input" value={currentUser?.email || ''} disabled />
                  <span className="settings-input-meta">Your login email is visible only to you.</span>
                </label>
              </section>

              <div className="settings-profile-actions-row">
                <button type="submit" className="forum-primary-btn" disabled={!hasProfileChanges || avatarUploading}>
                  Save Changes
                </button>
                <button type="button" className="forum-secondary-btn" onClick={resetProfileDraft} disabled={avatarUploading}>
                  Reset
                </button>
              </div>
            </form>

            <aside className="settings-profile-preview">
              <div className="settings-profile-preview-card">
                <p className="type-kicker mb-1">Public Preview</p>
                <div className="settings-profile-preview-head">
                  <Avatar
                    imageUrl={avatarPreviewUrl}
                    name={previewName}
                    size={64}
                  />
                  <div className="settings-profile-preview-copy">
                    <strong>{previewName}</strong>
                    <span>{previewHandle}</span>
                  </div>
                </div>
                <p className="settings-profile-preview-bio mb-0">{previewBio}</p>
              </div>
            </aside>
          </div>
        </section>

        <div className="settings-secondary-grid">
          <section
            ref={passwordRef}
            className={`settings-card ${searchParams.get('panel') === 'password' ? 'is-focused' : ''}`.trim()}
          >
            <h2 className="settings-panel-title mb-1">Password</h2>
            <p className="settings-panel-copy mb-3">Update your password for account security.</p>
            <form onSubmit={submitPassword} className="forum-form">
              <label>
                <span className="form-label">Current Password</span>
                <input
                  type="password"
                  className="form-control forum-input"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                />
              </label>
              <label>
                <span className="form-label">New Password</span>
                <input
                  type="password"
                  className="form-control forum-input"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                />
              </label>
              <button type="submit" className="forum-primary-btn">Update Password</button>
            </form>
          </section>

          <section
            ref={dangerRef}
            className={`settings-card settings-danger-card ${searchParams.get('panel') === 'danger' ? 'is-focused' : ''}`.trim()}
          >
            <h2 className="settings-panel-title mb-1">Danger Zone</h2>
            <p className="settings-panel-copy mb-3">Deleting your account removes your profile, posts, and associated activity.</p>
            <label className="mb-3">
              <span className="form-label">Type "delete" to confirm</span>
              <input
                className="form-control forum-input"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder="delete"
              />
            </label>
            <button type="button" className="forum-danger-btn" onClick={deleteAccount}>Delete Account</button>
          </section>
        </div>
      </section>
    </div>
  );
}
