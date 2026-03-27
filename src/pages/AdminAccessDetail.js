import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  apiGetSiteAdminAccess,
  apiRemoveSiteAdminAccess,
  apiUpdateSiteAdminAccess
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

export default function AdminAccessDetail({ currentUser }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [access, setAccess] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
        const entry = (data.admins || []).find((item) => item.id === userId);
        setPermissionDraft(entry?.permissions || []);
        setError('');
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load admin access.');
      } finally {
        setLoading(false);
      }
    }

    loadAccess();
  }, [userId]);

  const adminEntry = useMemo(
    () => (access?.admins || []).find((entry) => entry.id === userId) || null,
    [access, userId]
  );
  const permissionDetails = useMemo(() => access?.availablePermissions || [], [access]);

  if (!loading && !adminEntry) {
    return <Navigate to="/admin/access" replace />;
  }

  const handleUpdate = async () => {
    const token = authStorage.getToken();
    if (!token || !userId) {
      setError('Please login first.');
      return;
    }

    setSubmitting('update');
    setMessage('');
    setError('');
    try {
      const response = await apiUpdateSiteAdminAccess(userId, {
        permissions: permissionDraft
      }, token);
      setAccess((current) => current ? { ...current, admins: response.admins || [] } : current);
      setMessage(response.message || 'Admin permissions updated.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to update admin permissions.');
    } finally {
      setSubmitting('');
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove admin access for ${adminEntry?.name || adminEntry?.email || 'this user'}?`)) {
      return;
    }

    const token = authStorage.getToken();
    if (!token || !userId) {
      setError('Please login first.');
      return;
    }

    setSubmitting('remove');
    setMessage('');
    setError('');
    try {
      await apiRemoveSiteAdminAccess(userId, token);
      navigate('/admin/access', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to remove admin access.');
      setSubmitting('');
    }
  };

  return (
    <div className="container page-shell my-forums-page">
      <section className="panel my-forums-panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-1">Admin</p>
            <h2 className="mb-1 type-title-md">Manage Admin Profile</h2>
            <p className="muted mb-0">
              Review and update the detailed permissions for this admin entry.
            </p>
          </div>
          <Link to="/admin/access" className="forum-secondary-btn text-decoration-none">
            Back to Admin Management
          </Link>
        </div>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-3`}>
            {error || message}
          </div>
        )}

        {loading ? (
          <p className="muted mb-0">Loading admin profile...</p>
        ) : (
          <div className="forum-admin-sections">
            <section className="forum-admin-panel">
              <div className="forum-admin-panel-head">
                <div>
                  <h5 className="mb-1">{adminEntry?.name || adminEntry?.email}</h5>
                  <p className="muted mb-0">
                    {adminEntry?.email}
                    {adminEntry?.isRootAdmin ? ' / Root admin' : ` / Updated ${formatTimestamp(adminEntry?.updatedAt)}`}
                    {adminEntry?.grantedByName ? ` / by ${adminEntry.grantedByName}` : ''}
                  </p>
                </div>
              </div>

              {adminEntry?.isRootAdmin ? (
                <p className="muted mb-0">Root admin permissions are managed through environment configuration and cannot be changed here.</p>
              ) : (
                <>
                  <div className="forum-admin-checkbox-grid">
                    {permissionDetails.map((permission) => (
                      <label key={permission.key} className="forum-admin-checkbox">
                        <input
                          type="checkbox"
                          checked={permissionDraft.includes(permission.key)}
                          onChange={() => setPermissionDraft((current) => togglePermission(current, permission.key))}
                          disabled={submitting !== ''}
                        />
                        <span>
                          <strong>{permission.label}</strong>
                          <small>{permission.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="forum-actions">
                    <button
                      type="button"
                      className="forum-primary-btn"
                      onClick={handleUpdate}
                      disabled={permissionDraft.length === 0 || submitting !== ''}
                    >
                      {submitting === 'update' ? 'Saving...' : 'Update Permissions'}
                    </button>
                    <button
                      type="button"
                      className="forum-danger-btn"
                      onClick={handleRemove}
                      disabled={submitting !== ''}
                    >
                      {submitting === 'remove' ? 'Removing...' : 'Remove Access'}
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
