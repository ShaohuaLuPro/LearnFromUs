import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  apiDeleteForum,
  apiGetForumAccess,
  apiTransferForumOwnership,
  apiUpdateForumDetails,
  apiUpdateForumSections,
  apiUpsertForumManager
} from '../api';
import { authStorage } from '../lib/authStorage';
import { getSectionLabel } from '../lib/sections';

const TAB_KEYS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sections', label: 'Sections' },
  { key: 'managers', label: 'Managers' },
  { key: 'settings', label: 'Settings' }
];

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

function normalizeSectionInput(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function mergeSectionIntoScope(currentScope = [], nextSection = '') {
  if (!nextSection) {
    return currentScope;
  }
  return [...new Set([...currentScope, nextSection])];
}

function scopesMatch(left = [], right = []) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isOwnerSpace(forum, userId) {
  return Boolean(forum?.isOwner || (forum?.ownerId && forum.ownerId === userId));
}

export default function MySpaceManage({ currentUser, forums = [], onLoadForums }) {
  const navigate = useNavigate();
  const params = useParams();
  const selectedForumId = String(params.spaceId || params.forumId || '').trim();

  const [activeTab, setActiveTab] = useState('overview');
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [actionKey, setActionKey] = useState('');
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [invitePermissions, setInvitePermissions] = useState([]);
  const [transferIdentifier, setTransferIdentifier] = useState('');
  const [overviewDraft, setOverviewDraft] = useState('');
  const [showCodeBlockToolsDraft, setShowCodeBlockToolsDraft] = useState(true);
  const [sectionScopeDraft, setSectionScopeDraft] = useState([]);
  const [sectionDraft, setSectionDraft] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const manageableSpaces = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    if (currentUser.isAdmin) {
      return forums;
    }
    return forums.filter((forum) => forum.ownerId === currentUser.id || forum.canManage);
  }, [currentUser, forums]);

  const selectedForum = useMemo(
    () => manageableSpaces.find((forum) => forum.id === selectedForumId) || null,
    [manageableSpaces, selectedForumId]
  );

  const activeForum = access?.forum || selectedForum;
  const selectedPermissionKeys = access?.viewerPermissions || selectedForum?.currentUserPermissions || [];
  const canManageAdmins = Boolean(access?.canManageAdmins);
  const canTransferOwnership = Boolean(access?.canTransferOwnership);
  const canManageForumDetails = Boolean(
    currentUser?.isAdmin
    || isOwnerSpace(activeForum, currentUser?.id)
    || selectedPermissionKeys.includes('manage_sections')
  );
  const canViewFollowers = Boolean(
    currentUser?.isAdmin
    || isOwnerSpace(activeForum, currentUser?.id)
    || selectedPermissionKeys.includes('view_followers')
  );
  const canDeleteForum = Boolean(
    currentUser?.isAdmin
    || isOwnerSpace(activeForum, currentUser?.id)
  );

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    if (!selectedForumId) {
      setLoading(false);
      setError('Space not found.');
      return;
    }

    let cancelled = false;

    async function loadAccess() {
      const token = authStorage.getToken();
      if (!token) {
        setError('Please login first.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await apiGetForumAccess(selectedForumId, token);
        if (!cancelled) {
          setAccess(data);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load this space workspace.');
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
  }, [currentUser, selectedForumId]);

  useEffect(() => {
    setInviteIdentifier('');
    setInvitePermissions([]);
    setTransferIdentifier('');
    setDeleteConfirmText('');
    setMessage('');
    setError('');
  }, [selectedForumId]);

  useEffect(() => {
    setOverviewDraft(activeForum?.description || '');
    setShowCodeBlockToolsDraft(activeForum?.showCodeBlockTools ?? true);
    setSectionScopeDraft(activeForum?.sectionScope || []);
    setSectionDraft('');
  }, [activeForum?.description, activeForum?.id, activeForum?.sectionScope, activeForum?.showCodeBlockTools]);

  const refreshAccess = async () => {
    if (!selectedForumId) {
      return;
    }
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Please login first.');
    }
    const data = await apiGetForumAccess(selectedForumId, token);
    setAccess(data);
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

  const handleSaveOverview = async (event) => {
    event.preventDefault();
    if (!selectedForumId) {
      return;
    }

    if (
      (overviewDraft || '').trim() === String(activeForum?.description || '').trim()
      && showCodeBlockToolsDraft === Boolean(activeForum?.showCodeBlockTools ?? true)
    ) {
      setMessage('Space details are already up to date.');
      setError('');
      return;
    }

    await runAction('save-overview', async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiUpdateForumDetails(selectedForumId, {
        description: overviewDraft,
        showCodeBlockTools: showCodeBlockToolsDraft
      }, token);
      await onLoadForums?.();
      await refreshAccess();
      setMessage(response.message || 'Space details updated.');
    });
  };

  const addSectionDraftValue = () => {
    const normalizedSection = normalizeSectionInput(sectionDraft);
    if (!normalizedSection) {
      setError('Enter a valid section name first.');
      setMessage('');
      return;
    }
    if (sectionScopeDraft.includes(normalizedSection)) {
      setError('That section already exists.');
      setMessage('');
      return;
    }
    setSectionScopeDraft((current) => mergeSectionIntoScope(current, normalizedSection));
    setSectionDraft('');
    setError('');
  };

  const removeSectionDraftValue = (sectionValue) => {
    if (sectionScopeDraft.length <= 1) {
      setError('A space must keep at least one section.');
      setMessage('');
      return;
    }
    setSectionScopeDraft((current) => current.filter((value) => value !== sectionValue));
    setError('');
  };

  const cancelSectionChanges = () => {
    setSectionScopeDraft(activeForum?.sectionScope || []);
    setSectionDraft('');
    setError('');
  };

  const handleSaveSections = async () => {
    if (!selectedForumId) {
      return;
    }

    const pendingSection = normalizeSectionInput(sectionDraft);
    if (sectionDraft.trim() && !pendingSection) {
      setError('Enter letters or numbers for section names.');
      setMessage('');
      return;
    }

    const nextScope = pendingSection
      ? mergeSectionIntoScope(sectionScopeDraft, pendingSection)
      : sectionScopeDraft;

    if (nextScope.length === 0) {
      setError('A space must keep at least one section.');
      setMessage('');
      return;
    }

    if (scopesMatch(nextScope, activeForum?.sectionScope || [])) {
      setSectionDraft('');
      setError('');
      return;
    }

    await runAction('save-sections', async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }
      const response = await apiUpdateForumSections(selectedForumId, { sectionScope: nextScope }, token);
      await onLoadForums?.();
      await refreshAccess();
      setSectionScopeDraft(nextScope);
      setSectionDraft('');
      setMessage(response.message || 'Space sections updated.');
    });
  };

  const handleInviteManager = async (event) => {
    event.preventDefault();
    if (!selectedForumId) {
      return;
    }

    await runAction('invite-manager', async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiUpsertForumManager(selectedForumId, {
        identifier: inviteIdentifier,
        permissions: invitePermissions
      }, token);
      await onLoadForums?.();
      await refreshAccess();
      setInviteIdentifier('');
      setInvitePermissions([]);
      setMessage(response.message || 'Space manager invite sent.');
    });
  };

  const handleTransferOwnership = async (event) => {
    event.preventDefault();
    if (!selectedForumId) {
      return;
    }
    if (!window.confirm('Transfer ownership now? The new owner will immediately become the primary owner.')) {
      return;
    }

    await runAction('transfer-ownership', async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }
      const response = await apiTransferForumOwnership(selectedForumId, { identifier: transferIdentifier }, token);
      await onLoadForums?.();
      await refreshAccess();
      setTransferIdentifier('');
      setMessage(response.message || 'Space ownership transferred.');
    });
  };

  const handleDeleteForum = async () => {
    if (!selectedForumId || !activeForum) {
      return;
    }
    if ((deleteConfirmText || '').trim() !== String(activeForum.name || '').trim()) {
      setError('Type the space name exactly before deleting.');
      setMessage('');
      return;
    }
    if (!window.confirm(`Delete "${activeForum.name}" permanently? This action cannot be undone.`)) {
      return;
    }

    await runAction('delete-space', async () => {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }
      await apiDeleteForum(selectedForumId, token);
      await onLoadForums?.();
      navigate('/my-spaces');
    });
  };

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (selectedForumId && forums.length > 0 && !selectedForum && !currentUser.isAdmin) {
    return <Navigate to="/my-spaces" replace />;
  }

  return (
    <div className="container page-shell">
      <section className="my-space-manage-shell" aria-label="Manage space workspace">
        <header className="my-space-manage-header">
          <div>
            <p className="type-kicker mb-1">Workspace</p>
            <h1 className="community-feed-title mb-1">
              Manage {activeForum?.name || 'Space'}
            </h1>
            <p className="my-posts-subtext mb-0">
              Configure details, sections, managers, and permissions in a dedicated space workspace.
            </p>
          </div>
          <div className="my-space-manage-header-actions">
            <Link to="/my-spaces" className="forum-secondary-btn text-decoration-none">
              Back to My Spaces
            </Link>
            {activeForum?.slug ? (
              <Link to={`/forum/${activeForum.slug}`} className="forum-primary-btn text-decoration-none">
                View Space
              </Link>
            ) : null}
            {activeForum?.slug && canViewFollowers ? (
              <Link to={`/forum/${activeForum.slug}/followers`} className="forum-secondary-btn text-decoration-none">
                Followers
              </Link>
            ) : null}
          </div>
        </header>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'}`}>
            {error || message}
          </div>
        )}

        <nav className="my-space-manage-tabs" aria-label="Manage space tabs">
          {TAB_KEYS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`my-space-manage-tab ${activeTab === tab.key ? 'is-active' : ''}`.trim()}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {loading && !access ? (
          <section className="settings-card">
            <p className="muted mb-0">Loading space workspace...</p>
          </section>
        ) : null}

        {!loading && !activeForum ? (
          <section className="settings-card">
            <h2 className="my-posts-empty-title mb-0">Space not found</h2>
            <p className="my-posts-empty-copy mb-0">
              This space is unavailable or you do not have access.
            </p>
          </section>
        ) : null}

        {activeForum ? (
          <div className="my-space-manage-body">
            {activeTab === 'overview' ? (
              <section className="forum-admin-panel">
                <div className="forum-admin-panel-head">
                  <div>
                    <h5 className="mb-1">Space Details</h5>
                    <p className="muted mb-0">
                      Keep your space overview and composer behavior aligned with community needs.
                    </p>
                  </div>
                </div>

                <form className="forum-admin-create-form" onSubmit={handleSaveOverview}>
                  <label className="w-100">
                    <span className="form-label">Overview</span>
                    <textarea
                      className="form-control forum-input forum-admin-textarea"
                      value={overviewDraft}
                      onChange={(event) => setOverviewDraft(event.target.value)}
                      placeholder="Write a concise space overview."
                      rows={4}
                      disabled={!canManageForumDetails || actionKey === 'save-overview'}
                    />
                  </label>
                  <label className="forum-admin-checkbox forum-admin-single-toggle">
                    <input
                      type="checkbox"
                      checked={showCodeBlockToolsDraft}
                      onChange={(event) => setShowCodeBlockToolsDraft(event.target.checked)}
                      disabled={!canManageForumDetails || actionKey === 'save-overview'}
                    />
                    <span>
                      <strong>Show code block shortcut in composer</strong>
                      <small>Turn this off for spaces that do not need quick code formatting tools.</small>
                    </span>
                  </label>
                  {canManageForumDetails ? (
                    <button type="submit" className="forum-primary-btn" disabled={actionKey === 'save-overview'}>
                      {actionKey === 'save-overview' ? 'Saving...' : 'Save Details'}
                    </button>
                  ) : (
                    <p className="muted mb-0">You can view details here but do not have edit permission.</p>
                  )}
                </form>

                <div className="my-space-manage-permission-strip">
                  <strong>Your permission scope</strong>
                  <div className="my-space-manage-chip-row">
                    {selectedPermissionKeys.length > 0 ? selectedPermissionKeys.map((permission) => (
                      <span key={permission} className="my-space-meta-pill">{permission}</span>
                    )) : (
                      <span className="my-space-meta-pill">Owner or admin scope</span>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === 'sections' ? (
              <section className="forum-admin-panel">
                <div className="forum-admin-panel-head">
                  <div>
                    <h5 className="mb-1">Sections</h5>
                    <p className="muted mb-0">
                      Keep section taxonomy clean so content is easy to discover and moderate.
                    </p>
                  </div>
                </div>

                {canManageForumDetails ? (
                  <div className="forum-section-admin mb-3">
                    <div className="forum-section-admin-controls">
                      <input
                        className="form-control forum-input forum-section-input"
                        value={sectionDraft}
                        onChange={(event) => setSectionDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addSectionDraftValue();
                          }
                        }}
                        placeholder="Type a section name"
                        disabled={actionKey === 'save-sections'}
                      />
                      <button
                        type="button"
                        className="forum-primary-btn"
                        onClick={addSectionDraftValue}
                        disabled={actionKey === 'save-sections'}
                      >
                        Add Section
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="section-chip-wrap">
                  {(canManageForumDetails ? sectionScopeDraft : (activeForum.sectionScope || [])).map((section) => (
                    <div key={section} className={`section-chip-row ${canManageForumDetails ? 'is-editing' : ''}`.trim()}>
                      <span className="section-chip is-active">
                        <span>{getSectionLabel(section)}</span>
                      </span>
                      {canManageForumDetails ? (
                        <button
                          type="button"
                          className="section-chip-remove"
                          onClick={() => removeSectionDraftValue(section)}
                          disabled={actionKey === 'save-sections'}
                          aria-label={`Remove ${getSectionLabel(section)}`}
                        >
                          x
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                {canManageForumDetails ? (
                  <div className="forum-section-admin-actions mt-3">
                    <button
                      type="button"
                      className="forum-primary-btn"
                      onClick={() => { void handleSaveSections(); }}
                      disabled={actionKey === 'save-sections'}
                    >
                      {actionKey === 'save-sections' ? 'Saving...' : 'Save Sections'}
                    </button>
                    <button
                      type="button"
                      className="forum-secondary-btn"
                      onClick={cancelSectionChanges}
                      disabled={actionKey === 'save-sections'}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="muted mt-3 mb-0">You can view sections but do not have edit permission.</p>
                )}
              </section>
            ) : null}

            {activeTab === 'managers' ? (
              <section className="forum-admin-panel">
                <div className="forum-admin-panel-head">
                  <div>
                    <h5 className="mb-1">Space Managers</h5>
                    <p className="muted mb-0">
                      Invite people with focused permissions and keep management responsibilities clear.
                    </p>
                  </div>
                </div>

                {canManageAdmins ? (
                  <form className="forum-admin-create-form" onSubmit={handleInviteManager}>
                    <label className="w-100">
                      <span className="form-label">Invite a manager</span>
                      <input
                        className="form-control forum-input"
                        value={inviteIdentifier}
                        onChange={(event) => setInviteIdentifier(event.target.value)}
                        placeholder="username, email, or user id"
                        disabled={actionKey === 'invite-manager'}
                      />
                    </label>
                    <div className="forum-admin-checkbox-grid">
                      {(access?.availablePermissions || []).map((permission) => (
                        <label key={permission.key} className="forum-admin-checkbox">
                          <input
                            type="checkbox"
                            checked={invitePermissions.includes(permission.key)}
                            onChange={() => setInvitePermissions((current) => (
                              current.includes(permission.key)
                                ? current.filter((item) => item !== permission.key)
                                : [...current, permission.key]
                            ))}
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
                      {actionKey === 'invite-manager' ? 'Sending...' : 'Send Invite'}
                    </button>
                  </form>
                ) : (
                  <p className="muted mb-3">
                    You can review the manager roster, but only users with manager access permission can edit it.
                  </p>
                )}

                {(access?.managers || []).length === 0 ? (
                  <p className="muted mb-0">No delegated managers yet.</p>
                ) : (
                  <div className="forum-admin-manager-list">
                    {access.managers.map((manager) => (
                      <article key={manager.id} className="forum-admin-manager-card">
                        <div className="forum-admin-manager-head">
                          <div>
                            <strong>{manager.name || manager.id}</strong>
                            <p className="muted mb-0">
                              Last updated {formatTimestamp(manager.updatedAt)}
                              {manager.grantedByName ? ` by ${manager.grantedByName}` : ''}
                            </p>
                          </div>
                          <Link to={`/my-spaces/${selectedForumId}/managers/${manager.id}`} className="forum-secondary-btn text-decoration-none">
                            Manage
                          </Link>
                        </div>
                        <p className="muted mb-0">{(manager.permissions || []).length} permissions assigned.</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {activeTab === 'settings' ? (
              <section className="forum-admin-panel">
                <div className="forum-admin-panel-head">
                  <div>
                    <h5 className="mb-1">Ownership and Advanced Settings</h5>
                    <p className="muted mb-0">
                      Ownership transfer and destructive actions are isolated here for safer operations.
                    </p>
                  </div>
                </div>

                <div className="forum-admin-owner-card">
                  <strong>{access?.owner?.name || activeForum.ownerName || 'No owner assigned'}</strong>
                  <span className="muted">{access?.owner?.id || activeForum.ownerId || 'Owner record unavailable'}</span>
                </div>

                {canTransferOwnership ? (
                  <form className="forum-admin-inline-form mt-3" onSubmit={handleTransferOwnership}>
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
                ) : null}

                <div className="my-space-manage-danger-zone">
                  <h6 className="mb-1">Danger zone</h6>
                  <p className="muted mb-2">
                    Permanently delete this space and all dependent content.
                  </p>
                  <label className="w-100">
                    <span className="form-label">Type "{activeForum.name}" to confirm</span>
                    <input
                      className="form-control forum-input"
                      value={deleteConfirmText}
                      onChange={(event) => setDeleteConfirmText(event.target.value)}
                      placeholder={activeForum.name}
                      disabled={!canDeleteForum || actionKey === 'delete-space'}
                    />
                  </label>
                  <button
                    type="button"
                    className="forum-danger-btn"
                    disabled={!canDeleteForum || actionKey === 'delete-space'}
                    onClick={() => { void handleDeleteForum(); }}
                  >
                    {actionKey === 'delete-space' ? 'Deleting...' : 'Delete Space'}
                  </button>
                  {!canDeleteForum ? (
                    <p className="muted mb-0">Only owners or admins can delete a space.</p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
