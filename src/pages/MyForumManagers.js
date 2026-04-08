import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  apiGetForumAccess,
  apiRemoveForumManager,
  apiUpdateForumManager
} from '../api';
import { authStorage } from '../lib/authStorage';

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return 'Just now';
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

export default function MyForumManagers({ currentUser, forums = [], onLoadForums }) {
  const { forumId, managerId } = useParams();
  const [access, setAccess] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [actionKey, setActionKey] = useState('');

  const manageableForums = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.isAdmin) {
      return forums;
    }

    return forums.filter((forum) => forum.ownerId === currentUser.id || forum.canManage);
  }, [currentUser, forums]);

  const selectedForum = useMemo(
    () => manageableForums.find((forum) => forum.id === forumId) || null,
    [forumId, manageableForums]
  );

  const selectedManager = useMemo(
    () => (access?.managers || []).find((manager) => manager.id === managerId) || null,
    [access, managerId]
  );

  const canManageAdmins = Boolean(access?.canManageAdmins);

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      if (!forumId) {
        return;
      }

      const token = authStorage.getToken();
      if (!token) {
        setError('Please login first.');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await apiGetForumAccess(forumId, token);
        if (cancelled) {
          return;
        }

        setAccess(data);
        const manager = (data.managers || []).find((entry) => entry.id === managerId);
        setPermissionDraft(manager?.permissions || []);
        setError('');
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load space manager.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAccess();
    return () => {
      cancelled = true;
    };
  }, [forumId, managerId]);

  const refreshAccess = async () => {
    if (!forumId) {
      return;
    }

    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Please login first.');
    }

    const data = await apiGetForumAccess(forumId, token);
    setAccess(data);
    const manager = (data.managers || []).find((entry) => entry.id === managerId);
    setPermissionDraft(manager?.permissions || []);
  };

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

  const handleUpdate = async () => {
    if (!forumId || !managerId) {
      return;
    }

    await runAction('update-manager', async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiUpdateForumManager(forumId, managerId, {
        permissions: permissionDraft
      }, token);
      await refreshAccess();
      await onLoadForums?.();
      setMessage(response.message || 'Space manager updated.');
    });
  };

  const handleRemove = async () => {
    if (!forumId || !managerId || !selectedManager) {
      return;
    }
    if (!window.confirm(`Remove ${selectedManager.name || 'this manager'} from the space admin team?`)) {
      return;
    }

    await runAction('remove-manager', async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      await apiRemoveForumManager(forumId, managerId, token);
      await onLoadForums?.();
      window.location.assign('/my-spaces');
    });
  };

  if ((forumId && forums.length > 0 && !selectedForum) || (!loading && !selectedManager)) {
    return <Navigate to="/my-spaces" replace />;
  }

  return (
    <div className="container page-shell my-forums-page">
      <section className="panel my-forums-panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-1">Workspace</p>
            <h2 className="mb-1 type-title-md">Manage Space Manager</h2>
            <p className="muted mb-0">
              Review and update the detailed permissions for this space manager.
            </p>
          </div>
          <Link to="/my-spaces" className="forum-secondary-btn text-decoration-none">
            Back to My Spaces
          </Link>
        </div>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-3`}>
            {error || message}
          </div>
        )}

        {loading ? (
          <p className="muted mb-0">Loading space manager...</p>
        ) : selectedManager && access ? (
          <section className="forum-admin-panel">
            <div className="forum-admin-panel-head">
              <div>
                <h5 className="mb-1">{selectedManager.name || selectedManager.id}</h5>
                <p className="muted mb-0">
                  Last updated {formatTimestamp(selectedManager.updatedAt)}
                  {selectedManager.grantedByName ? ` by ${selectedManager.grantedByName}` : ''}
                </p>
              </div>
            </div>

            {canManageAdmins ? (
              <>
                <div className="forum-admin-checkbox-grid">
                  {(access.availablePermissions || []).map((permission) => (
                    <label key={permission.key} className="forum-admin-checkbox">
                      <input
                        type="checkbox"
                        checked={permissionDraft.includes(permission.key)}
                        onChange={() => setPermissionDraft((current) => togglePermission(current, permission.key))}
                        disabled={actionKey !== ''}
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
                    disabled={permissionDraft.length === 0 || actionKey !== ''}
                  >
                    {actionKey === 'update-manager' ? 'Saving...' : 'Update Permissions'}
                  </button>
                  <button
                    type="button"
                    className="forum-danger-btn"
                    onClick={handleRemove}
                    disabled={actionKey !== ''}
                  >
                    {actionKey === 'remove-manager' ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </>
            ) : (
              <p className="muted mb-0">You do not have permission to edit this space manager.</p>
            )}
          </section>
        ) : null}
      </section>
    </div>
  );
}
