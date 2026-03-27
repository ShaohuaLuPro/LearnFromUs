import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiGetSiteAdminAccess,
  apiUpsertSiteAdminAccess
} from '../api';
import { authStorage } from '../lib/authStorage';

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return 'Managed outside the app';
  }

  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function togglePermission(list, permission) {
  return list.includes(permission)
    ? list.filter((item) => item !== permission)
    : [...list, permission];
}

export default function AdminAccess({ currentUser }) {
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [actionKey, setActionKey] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [invitePermissions, setInvitePermissions] = useState([]);

  const canManageAdminAccess = Boolean(currentUser?.canManageAdminAccess);

  useEffect(() => {
    async function loadAccess() {
      const token = authStorage.getToken();
      if (!token) {
        setError('Please login first.');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await apiGetSiteAdminAccess(token);
        setAccess(data);
        setError('');
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load admin access.');
      } finally {
        setLoading(false);
      }
    }

    loadAccess();
  }, []);

  const adminEntries = useMemo(() => access?.admins || [], [access]);
  const permissionDetails = useMemo(() => access?.availablePermissions || [], [access]);

  const handleInvite = async (event) => {
    event.preventDefault();
    const token = authStorage.getToken();
    if (!token) {
      setError('Please login first.');
      return;
    }

    setActionKey('save-admin-access');
    setMessage('');
    setError('');
    try {
      const response = await apiUpsertSiteAdminAccess({
        identifier,
        permissions: invitePermissions
      }, token);
      setAccess((current) => current ? { ...current, admins: response.admins || [] } : current);
      setIdentifier('');
      setInvitePermissions([]);
      setMessage(response.message || 'Admin access saved.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save admin access.');
    } finally {
      setActionKey('');
    }
  };

  return (
    <div className="container page-shell my-forums-page">
      <section className="panel my-forums-panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-1">Admin</p>
            <h2 className="mb-1 type-title-md">Admin Management</h2>
            <p className="muted mb-0">
              Grant site-level permissions here, then open an admin profile to adjust detailed access.
            </p>
          </div>
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">
            Back to Forum
          </Link>
        </div>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-3`}>
            {error || message}
          </div>
        )}

        {loading ? (
          <p className="muted mb-0">Loading admin access...</p>
        ) : (
          <div className="forum-admin-sections">
            <section className="forum-admin-panel">
              <div className="forum-admin-panel-head">
                <div>
                  <h5 className="mb-1">Grant Admin Access</h5>
                  <p className="muted mb-0">
                    {canManageAdminAccess
                      ? 'Add someone by username, email, or user id, then choose what they can do.'
                      : 'You can see the current admin team here, but you do not have permission to change access.'}
                  </p>
                </div>
              </div>

              {canManageAdminAccess && (
                <form className="forum-admin-create-form" onSubmit={handleInvite}>
                  <label className="w-100">
                    <span className="form-label">User</span>
                    <input
                      className="form-control forum-input"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      placeholder="username, email, or user id"
                      disabled={actionKey === 'save-admin-access'}
                    />
                  </label>
                  <div className="forum-admin-checkbox-grid">
                    {permissionDetails.map((permission) => (
                      <label key={permission.key} className="forum-admin-checkbox">
                        <input
                          type="checkbox"
                          checked={invitePermissions.includes(permission.key)}
                          onChange={() => setInvitePermissions((current) => togglePermission(current, permission.key))}
                          disabled={actionKey === 'save-admin-access'}
                        />
                        <span>
                          <strong>{permission.label}</strong>
                          <small>{permission.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="forum-primary-btn"
                    disabled={!identifier.trim() || invitePermissions.length === 0 || actionKey === 'save-admin-access'}
                  >
                    {actionKey === 'save-admin-access' ? 'Saving...' : 'Save Admin Access'}
                  </button>
                </form>
              )}
            </section>

            <section className="forum-admin-panel">
              <div className="forum-admin-panel-head">
                <div>
                  <h5 className="mb-1">Current Admin Team</h5>
                  <p className="muted mb-0">This page only shows who is on the team. Open a profile to change detailed permissions.</p>
                </div>
              </div>

              {adminEntries.length === 0 ? (
                <p className="muted mb-0">No admin access entries yet.</p>
              ) : (
                <div className="forum-admin-manager-list">
                  {adminEntries.map((entry) => (
                    <article key={entry.id} className="forum-admin-manager-card">
                      <div className="forum-admin-manager-head">
                        <div>
                          <strong>{entry.name || entry.email}</strong>
                          <p className="muted mb-0">
                            {entry.email}
                            {entry.isRootAdmin ? ' / Root admin' : ` / Updated ${formatTimestamp(entry.updatedAt)}`}
                            {entry.grantedByName ? ` / by ${entry.grantedByName}` : ''}
                          </p>
                        </div>
                        {canManageAdminAccess && (
                          <Link to={`/admin/access/${entry.id}`} className="forum-secondary-btn text-decoration-none">
                            Manage
                          </Link>
                        )}
                      </div>
                      <p className="muted mb-0">
                        {entry.isRootAdmin
                          ? 'Root admin with full access.'
                          : `${(entry.permissions || []).length} permissions assigned.`}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
