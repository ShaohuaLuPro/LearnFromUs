import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiGetForumAccess,
  apiRemoveForumManager,
  apiTransferForumOwnership,
  apiUpdateForumManager,
  apiUpsertForumManager
} from '../api';
import { authStorage } from '../lib/authStorage';
import { getSectionLabel } from '../lib/sections';

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

function sortForums(items = []) {
  return [...items].sort((a, b) =>
    Number(b.followerCount ?? 0) - Number(a.followerCount ?? 0)
    || String(a.name || '').localeCompare(String(b.name || ''))
  );
}

export default function MyForums({ currentUser, forums = [], onLoadForums }) {
  const [selectedForumId, setSelectedForumId] = useState('');
  const [accessByForumId, setAccessByForumId] = useState({});
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessMessage, setAccessMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionKey, setActionKey] = useState('');
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [invitePermissions, setInvitePermissions] = useState([]);
  const [transferIdentifier, setTransferIdentifier] = useState('');
  const [managerPermissionDrafts, setManagerPermissionDrafts] = useState({});

  const manageableForums = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.isAdmin) {
      return sortForums(forums);
    }

    return sortForums(
      forums.filter((forum) => forum.ownerId === currentUser.id || forum.canManage)
    );
  }, [currentUser, forums]);

  useEffect(() => {
    if (manageableForums.length === 0) {
      setSelectedForumId('');
      return;
    }

    if (!selectedForumId || !manageableForums.some((forum) => forum.id === selectedForumId)) {
      setSelectedForumId(manageableForums[0].id);
    }
  }, [manageableForums, selectedForumId]);

  const selectedForum = useMemo(
    () => manageableForums.find((forum) => forum.id === selectedForumId) || null,
    [manageableForums, selectedForumId]
  );

  const selectedAccess = selectedForumId ? accessByForumId[selectedForumId] || null : null;

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      if (!selectedForumId) {
        return;
      }

      const token = authStorage.getToken();
      if (!token) {
        setAccessMessage('Please login first.');
        return;
      }

      setAccessLoading(true);
      setAccessMessage('');
      try {
        const data = await apiGetForumAccess(selectedForumId, token);
        if (cancelled) {
          return;
        }

        setAccessByForumId((current) => ({
          ...current,
          [selectedForumId]: data
        }));
        setManagerPermissionDrafts((current) => ({
          ...current,
          ...Object.fromEntries((data.managers || []).map((manager) => [manager.id, manager.permissions || []]))
        }));
      } catch (error) {
        if (!cancelled) {
          setAccessMessage(error instanceof Error ? error.message : 'Failed to load forum permissions.');
        }
      } finally {
        if (!cancelled) {
          setAccessLoading(false);
        }
      }
    }

    loadAccess();
    return () => {
      cancelled = true;
    };
  }, [selectedForumId]);

  useEffect(() => {
    setInviteIdentifier('');
    setInvitePermissions([]);
    setTransferIdentifier('');
    setActionMessage('');
    setActionError('');
  }, [selectedForumId]);

  const selectedPermissionKeys = selectedAccess?.viewerPermissions || selectedForum?.currentUserPermissions || [];
  const canManageAdmins = Boolean(selectedAccess?.canManageAdmins);
  const canTransferOwnership = Boolean(selectedAccess?.canTransferOwnership);
  const canViewFollowers = Boolean(
    currentUser?.isAdmin
    || selectedForum?.ownerId === currentUser?.id
    || selectedPermissionKeys.includes('view_followers')
  );

  const refreshSelectedForum = async () => {
    if (!selectedForumId) {
      return null;
    }

    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Please login first.');
    }

    const data = await apiGetForumAccess(selectedForumId, token);
    setAccessByForumId((current) => ({
      ...current,
      [selectedForumId]: data
    }));
    setManagerPermissionDrafts((current) => ({
      ...current,
      ...Object.fromEntries((data.managers || []).map((manager) => [manager.id, manager.permissions || []]))
    }));
    return data;
  };

  const handleAction = async (key, runner) => {
    setActionKey(key);
    setActionMessage('');
    setActionError('');
    try {
      await runner();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setActionKey('');
    }
  };

  const handleInviteManager = async (event) => {
    event.preventDefault();
    if (!selectedForumId) {
      return;
    }

    await handleAction('invite-manager', async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiUpsertForumManager(selectedForumId, {
        identifier: inviteIdentifier,
        permissions: invitePermissions
      }, token);
      await refreshSelectedForum();
      await onLoadForums?.();
      setInviteIdentifier('');
      setInvitePermissions([]);
      setActionMessage(response.message || 'Forum manager saved.');
    });
  };

  const handleSaveManager = async (managerId) => {
    if (!selectedForumId) {
      return;
    }

    await handleAction(`save-${managerId}`, async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiUpdateForumManager(selectedForumId, managerId, {
        permissions: managerPermissionDrafts[managerId] || []
      }, token);
      await refreshSelectedForum();
      await onLoadForums?.();
      setActionMessage(response.message || 'Forum manager updated.');
    });
  };

  const handleRemoveManager = async (managerId, managerName) => {
    if (!selectedForumId) {
      return;
    }
    if (!window.confirm(`Remove ${managerName || 'this manager'} from the forum admin team?`)) {
      return;
    }

    await handleAction(`remove-${managerId}`, async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiRemoveForumManager(selectedForumId, managerId, token);
      await refreshSelectedForum();
      await onLoadForums?.();
      setActionMessage(response.message || 'Forum manager removed.');
    });
  };

  const handleTransferOwnership = async (event) => {
    event.preventDefault();
    if (!selectedForumId) {
      return;
    }
    if (!window.confirm('Transfer ownership? The new owner will become the primary forum owner immediately.')) {
      return;
    }

    await handleAction('transfer-ownership', async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiTransferForumOwnership(selectedForumId, { identifier: transferIdentifier }, token);
      await onLoadForums?.();
      setTransferIdentifier('');
      setActionMessage(response.message || 'Forum ownership transferred.');
    });
  };

  return (
    <div className="container page-shell my-forums-page">
      <section className="panel my-forums-panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-1">Workspace</p>
            <h2 className="mb-1 type-title-md">My Forums</h2>
            <p className="muted mb-0">
              Manage forums you own or help run. You can assign focused permissions instead of giving everyone full control.
            </p>
          </div>
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">
            Back to Forum
          </Link>
        </div>

        {manageableForums.length === 0 ? (
          <section className="settings-card">
            <h4 className="mb-2">No manageable forums yet</h4>
            <p className="muted mb-3">
              Once you own a forum or receive forum-level permissions, it will show up here.
            </p>
            <Link to="/forums/request" className="forum-primary-btn text-decoration-none">
              Create Forum
            </Link>
          </section>
        ) : (
          <div className="forum-admin-layout">
            <aside className="forum-admin-sidebar">
              {manageableForums.map((forum) => {
                const isActive = forum.id === selectedForumId;
                const forumPermissionSummary = forum.isOwner
                  ? 'Owner'
                  : currentUser?.isAdmin
                    ? 'Site admin'
                    : `${(forum.currentUserPermissions || []).length} permissions`;

                return (
                  <button
                    key={forum.id}
                    type="button"
                    className={`forum-admin-forum-card ${isActive ? 'is-active' : ''}`.trim()}
                    onClick={() => setSelectedForumId(forum.id)}
                  >
                    <div className="forum-follow-card-topline">
                      <span className="forum-tag">{forum.isOwner ? 'Owner' : 'Manager'}</span>
                      <span className="muted">{forum.followerCount ?? 0} followers</span>
                    </div>
                    <strong>{forum.name}</strong>
                    <p className="muted mb-0">{forum.description || 'Manage this forum from here.'}</p>
                    <span className="forum-follow-meta">
                      {(forum.sectionScope || []).slice(0, 4).map((section) => getSectionLabel(section)).join(' 路 ') || 'No sections'}
                    </span>
                    <span className="forum-follow-meta">{forumPermissionSummary}</span>
                  </button>
                );
              })}
            </aside>

            <div className="forum-admin-main">
              {selectedForum && (
                <section className="settings-card forum-admin-shell">
                  <div className="forum-admin-shell-head">
                    <div>
                      <div className="forum-follow-card-topline">
                        <span className="forum-tag">{selectedForum.isOwner ? 'Owner Access' : 'Forum Manager'}</span>
                        <span className="muted">{selectedForum.livePostCount ?? selectedForum.postCount ?? 0} posts</span>
                      </div>
                      <h4 className="mb-1">{selectedForum.name}</h4>
                      <p className="muted mb-2">
                        {selectedForum.description || 'Manage your team access and forum responsibilities here.'}
                      </p>
                      <div className="forum-post-kicker">
                        <span className="forum-tag">{selectedForum.followerCount ?? 0} followers</span>
                        {(selectedAccess?.viewerPermissions || []).map((permissionKey) => {
                          const detail = (selectedAccess?.availablePermissions || []).find((item) => item.key === permissionKey);
                          return (
                            <span key={permissionKey} className="forum-tag">
                              {detail?.label || permissionKey}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="forum-actions">
                      <Link to={`/forum/${selectedForum.slug}`} className="forum-primary-btn text-decoration-none">
                        Open Forum
                      </Link>
                      {canViewFollowers && (
                        <Link to={`/forum/${selectedForum.slug}/followers`} className="forum-secondary-btn text-decoration-none">
                          View Followers
                        </Link>
                      )}
                    </div>
                  </div>

                  {accessMessage && <div className="settings-alert is-error mb-3">{accessMessage}</div>}
                  {actionError && <div className="settings-alert is-error mb-3">{actionError}</div>}
                  {actionMessage && <div className="settings-alert is-success mb-3">{actionMessage}</div>}

                  {accessLoading && !selectedAccess ? (
                    <p className="muted mb-0">Loading forum access...</p>
                  ) : selectedAccess ? (
                    <div className="forum-admin-sections">
                      <section className="forum-admin-panel">
                        <div className="forum-admin-panel-head">
                          <div>
                            <h5 className="mb-1">Current Owner</h5>
                            <p className="muted mb-0">The owner has full forum access automatically.</p>
                          </div>
                        </div>
                        <div className="forum-admin-owner-card">
                          <strong>{selectedAccess.owner?.name || 'No owner assigned'}</strong>
                          <span className="muted">{selectedAccess.owner?.id || 'Owner record unavailable'}</span>
                        </div>
                        {canTransferOwnership && (
                          <form className="forum-admin-inline-form" onSubmit={handleTransferOwnership}>
                            <label className="w-100">
                              <span className="form-label">Transfer ownership to</span>
                              <input
                                className="form-control forum-input"
                                value={transferIdentifier}
                                onChange={(event) => setTransferIdentifier(event.target.value)}
                                placeholder="username, email, or user id"
                                disabled={actionKey === 'transfer-ownership'}
                              />
                            </label>
                            <button
                              type="submit"
                              className="forum-secondary-btn"
                              disabled={!transferIdentifier.trim() || actionKey === 'transfer-ownership'}
                            >
                              {actionKey === 'transfer-ownership' ? 'Transferring...' : 'Transfer Ownership'}
                            </button>
                          </form>
                        )}
                      </section>

                      <section className="forum-admin-panel">
                        <div className="forum-admin-panel-head">
                          <div>
                            <h5 className="mb-1">Available Permissions</h5>
                            <p className="muted mb-0">Grant only the responsibilities each forum admin really needs.</p>
                          </div>
                        </div>
                        <div className="forum-admin-permission-list">
                          {(selectedAccess.availablePermissions || []).map((permission) => (
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
                            <h5 className="mb-1">Forum Managers</h5>
                            <p className="muted mb-0">
                              {canManageAdmins
                                ? 'Add managers and choose exactly what they can do.'
                                : 'You can view the team here, but only someone with admin-management permission can change it.'}
                            </p>
                          </div>
                        </div>

                        {canManageAdmins && (
                          <form className="forum-admin-create-form" onSubmit={handleInviteManager}>
                            <label className="w-100">
                              <span className="form-label">Add or update a forum manager</span>
                              <input
                                className="form-control forum-input"
                                value={inviteIdentifier}
                                onChange={(event) => setInviteIdentifier(event.target.value)}
                                placeholder="username, email, or user id"
                                disabled={actionKey === 'invite-manager'}
                              />
                            </label>
                            <div className="forum-admin-checkbox-grid">
                              {(selectedAccess.availablePermissions || []).map((permission) => (
                                <label key={permission.key} className="forum-admin-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={invitePermissions.includes(permission.key)}
                                    onChange={() => setInvitePermissions((current) => togglePermission(current, permission.key))}
                                    disabled={actionKey === 'invite-manager'}
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
                              disabled={!inviteIdentifier.trim() || invitePermissions.length === 0 || actionKey === 'invite-manager'}
                            >
                              {actionKey === 'invite-manager' ? 'Saving...' : 'Save Manager Permissions'}
                            </button>
                          </form>
                        )}

                        {(selectedAccess.managers || []).length === 0 ? (
                          <p className="muted mb-0">No delegated forum managers yet.</p>
                        ) : (
                          <div className="forum-admin-manager-list">
                            {selectedAccess.managers.map((manager) => (
                              <article key={manager.id} className="forum-admin-manager-card">
                                <div className="forum-admin-manager-head">
                                  <div>
                                    <strong>{manager.name || manager.id}</strong>
                                    <p className="muted mb-0">
                                      Last updated {formatTimestamp(manager.updatedAt)}
                                      {manager.grantedByName ? ` by ${manager.grantedByName}` : ''}
                                    </p>
                                  </div>
                                  {canManageAdmins && (
                                    <button
                                      type="button"
                                      className="forum-secondary-btn"
                                      onClick={() => handleRemoveManager(manager.id, manager.name)}
                                      disabled={actionKey === `remove-${manager.id}`}
                                    >
                                      {actionKey === `remove-${manager.id}` ? 'Removing...' : 'Remove'}
                                    </button>
                                  )}
                                </div>

                                <div className="forum-admin-checkbox-grid">
                                  {(selectedAccess.availablePermissions || []).map((permission) => {
                                    const checkedPermissions = managerPermissionDrafts[manager.id] || manager.permissions || [];
                                    return (
                                      <label key={permission.key} className="forum-admin-checkbox">
                                        <input
                                          type="checkbox"
                                          checked={checkedPermissions.includes(permission.key)}
                                          onChange={() => setManagerPermissionDrafts((current) => ({
                                            ...current,
                                            [manager.id]: togglePermission(checkedPermissions, permission.key)
                                          }))}
                                          disabled={!canManageAdmins || actionKey === `save-${manager.id}`}
                                        />
                                        <span>
                                          <strong>{permission.label}</strong>
                                          <small>{permission.description}</small>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>

                                {canManageAdmins && (
                                  <div className="forum-actions">
                                    <button
                                      type="button"
                                      className="forum-primary-btn"
                                      onClick={() => handleSaveManager(manager.id)}
                                      disabled={(managerPermissionDrafts[manager.id] || []).length === 0 || actionKey === `save-${manager.id}`}
                                    >
                                      {actionKey === `save-${manager.id}` ? 'Saving...' : 'Update Permissions'}
                                    </button>
                                  </div>
                                )}
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  ) : null}
                </section>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
