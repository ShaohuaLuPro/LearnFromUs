import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiGetSiteAdminAccess,
  apiRemoveSiteAdminAccess,
  apiUpdateSiteAdminAccess,
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
  const [permissionDrafts, setPermissionDrafts] = useState({});

  const canManageAdminAccess = Boolean(currentUser?.canManageAdminAccess);

  const loadAccess = async () => {
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
      setPermissionDrafts(
        Object.fromEntries((data.admins || []).map((entry) => [entry.id, entry.permissions || []]))
      );
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load admin access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccess();
  }, []);

  const adminEntries = useMemo(() => access?.admins || [], [access]);
  const permissionDetails = useMemo(() => access?.availablePermissions || [], [access]);

  const runAction = async (key, runner) => {
    setActionKey(key);
    setMessage('');
    setError('');
    try {
      await runner();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Action failed.');
    } finally {
      setActionKey('');
    }
  };

  const handleInvite = async (event) => {
    event.preventDefault();
    await runAction('save-admin-access', async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiUpsertSiteAdminAccess({
        identifier,
        permissions: invitePermissions
      }, token);
      setAccess((current) => current ? { ...current, admins: response.admins || [] } : current);
      setPermissionDrafts((current) => ({
        ...current,
        ...Object.fromEntries((response.admins || []).map((entry) => [entry.id, entry.permissions || []]))
      }));
      setIdentifier('');
      setInvitePermissions([]);
      setMessage(response.message || 'Admin access saved.');
    });
  };

  const handleUpdate = async (userId) => {
    await runAction(`update-${userId}`, async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiUpdateSiteAdminAccess(userId, {
        permissions: permissionDrafts[userId] || []
      }, token);
      setAccess((current) => current ? { ...current, admins: response.admins || [] } : current);
      setPermissionDrafts((current) => ({
        ...current,
        ...Object.fromEntries((response.admins || []).map((entry) => [entry.id, entry.permissions || []]))
      }));
      setMessage(response.message || 'Admin permissions updated.');
    });
  };

  const handleRemove = async (userId, userName) => {
    if (!window.confirm(`Remove admin access for ${userName || 'this user'}?`)) {
      return;
    }

    await runAction(`remove-${userId}`, async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiRemoveSiteAdminAccess(userId, token);
      setAccess((current) => current ? { ...current, admins: response.admins || [] } : current);
      setPermissionDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[userId];
        return nextDrafts;
      });
      setMessage(response.message || 'Admin access removed.');
    });
  };

  return (
    <div className="container page-shell my-forums-page">
      <section className="panel my-forums-panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-1">Admin</p>
            <h2 className="mb-1 type-title-md">Admin Access</h2>
            <p className="muted mb-0">
              Grant site-level permissions so people can help with moderation, analytics, forum requests, or admin access itself.
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
                  <h5 className="mb-1">Available Site Permissions</h5>
                  <p className="muted mb-0">Use focused permissions instead of handing out full root admin access.</p>
                </div>
              </div>
              <div className="forum-admin-permission-list">
                {permissionDetails.map((permission) => (
                  <article key={permission.key} className="forum-admin-permission-card">
                    <strong>{permission.label}</strong>
                    <p className="muted mb-0">{permission.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="forum-admin-panel">
              <div className="forum-admin-panel-head">
                <div>
                  <h5 className="mb-1">Grant Or Update Access</h5>
                  <p className="muted mb-0">
                    {canManageAdminAccess
                      ? 'Add someone by username, email, or user id, then choose exactly what they can do.'
                      : 'You can see current site admins here, but you do not have permission to change access.'}
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
                  <p className="muted mb-0">Root admins always keep full access. Delegated admins can be updated here.</p>
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
                        {canManageAdminAccess && !entry.isRootAdmin && (
                          <button
                            type="button"
                            className="forum-secondary-btn"
                            onClick={() => handleRemove(entry.id, entry.name)}
                            disabled={actionKey === `remove-${entry.id}`}
                          >
                            {actionKey === `remove-${entry.id}` ? 'Removing...' : 'Remove'}
                          </button>
                        )}
                      </div>

                      <div className="forum-admin-checkbox-grid">
                        {permissionDetails.map((permission) => {
                          const checkedPermissions = permissionDrafts[entry.id] || entry.permissions || [];
                          return (
                            <label key={permission.key} className="forum-admin-checkbox">
                              <input
                                type="checkbox"
                                checked={checkedPermissions.includes(permission.key)}
                                onChange={() => setPermissionDrafts((current) => ({
                                  ...current,
                                  [entry.id]: togglePermission(checkedPermissions, permission.key)
                                }))}
                                disabled={!canManageAdminAccess || entry.isRootAdmin || actionKey === `update-${entry.id}`}
                              />
                              <span>
                                <strong>{permission.label}</strong>
                                <small>{permission.description}</small>
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      {canManageAdminAccess && !entry.isRootAdmin && (
                        <div className="forum-actions">
                          <button
                            type="button"
                            className="forum-primary-btn"
                            onClick={() => handleUpdate(entry.id)}
                            disabled={(permissionDrafts[entry.id] || []).length === 0 || actionKey === `update-${entry.id}`}
                          >
                            {actionKey === `update-${entry.id}` ? 'Saving...' : 'Update Permissions'}
                          </button>
                        </div>
                      )}
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
