import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiGetForumAccess,
  apiGetForumManagerInvites,
  apiUpdateForumDetails,
  apiUpdateForumSections,
  apiTransferForumOwnership,
  apiUpsertForumManager
} from '../api';
import Select from '../components/Select';
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

function sortForums(items = []) {
  return [...items].sort((a, b) =>
    Number(b.followerCount ?? 0) - Number(a.followerCount ?? 0)
    || String(a.name || '').localeCompare(String(b.name || ''))
  );
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

export default function MyForums({ currentUser, forums = [], onLoadForums }) {
  const [selectedForumId, setSelectedForumId] = useState('');
  const [forumSearchQuery, setForumSearchQuery] = useState('');
  const [accessByForumId, setAccessByForumId] = useState({});
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessMessage, setAccessMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionKey, setActionKey] = useState('');
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [invitePermissions, setInvitePermissions] = useState([]);
  const [transferIdentifier, setTransferIdentifier] = useState('');
  const [overviewDraft, setOverviewDraft] = useState('');
  const [sectionScopeDraft, setSectionScopeDraft] = useState([]);
  const [showCodeBlockToolsDraft, setShowCodeBlockToolsDraft] = useState(true);
  const [sectionDraft, setSectionDraft] = useState('');
  const [incomingInvites, setIncomingInvites] = useState([]);
  const [inviteInboxLoading, setInviteInboxLoading] = useState(false);

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

  const filteredManageableForums = useMemo(() => {
    const query = forumSearchQuery.trim().toLowerCase();
    if (!query) {
      return manageableForums;
    }

    return manageableForums.filter((forum) => {
      const sectionText = (forum.sectionScope || []).map((section) => getSectionLabel(section)).join(' ');
      return [
        forum.name,
        forum.description,
        forum.isOwner ? 'owner' : 'manager',
        sectionText
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [forumSearchQuery, manageableForums]);

  const forumSelectOptions = useMemo(() => {
    const options = filteredManageableForums.map((forum) => ({
      value: forum.id,
      label: forum.name
    }));

    if (selectedForum && !options.some((option) => option.value === selectedForum.id)) {
      options.unshift({
        value: selectedForum.id,
        label: selectedForum.name
      });
    }

    return options;
  }, [filteredManageableForums, selectedForum]);

  const selectedAccess = selectedForumId ? accessByForumId[selectedForumId] || null : null;
  const activeForum = selectedAccess?.forum || selectedForum;

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
    let cancelled = false;

    async function loadInvites() {
      if (!currentUser) {
        setIncomingInvites([]);
        return;
      }

      const token = authStorage.getToken();
      if (!token) {
        return;
      }

      setInviteInboxLoading(true);
      try {
        const data = await apiGetForumManagerInvites(token);
        if (!cancelled) {
          setIncomingInvites(data.invites || []);
        }
      } catch (error) {
        if (!cancelled) {
          setActionError(error instanceof Error ? error.message : 'Failed to load forum manager invites.');
        }
      } finally {
        if (!cancelled) {
          setInviteInboxLoading(false);
        }
      }
    }

    loadInvites();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    setInviteIdentifier('');
    setInvitePermissions([]);
    setTransferIdentifier('');
    setActionMessage('');
    setActionError('');
  }, [selectedForumId]);

  useEffect(() => {
    setOverviewDraft(activeForum?.description || '');
    setSectionScopeDraft(activeForum?.sectionScope || []);
    setShowCodeBlockToolsDraft(activeForum?.showCodeBlockTools ?? true);
    setSectionDraft('');
  }, [activeForum?.description, activeForum?.id, activeForum?.sectionScope, activeForum?.showCodeBlockTools]);

  const selectedPermissionKeys = selectedAccess?.viewerPermissions || selectedForum?.currentUserPermissions || [];
  const canManageAdmins = Boolean(selectedAccess?.canManageAdmins);
  const canTransferOwnership = Boolean(selectedAccess?.canTransferOwnership);
  const canManageForumDetails = Boolean(
    currentUser?.isAdmin
    || (activeForum?.ownerId && currentUser?.id === activeForum.ownerId)
    || selectedPermissionKeys.includes('manage_sections')
  );
  const canViewFollowers = Boolean(
    currentUser?.isAdmin
    || activeForum?.ownerId === currentUser?.id
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
    return data;
  };

  const handleInviteManager = async (event) => {
    event.preventDefault();
    if (!selectedForumId) {
      return;
    }

    setActionKey('invite-manager');
    setActionMessage('');
    setActionError('');
    try {
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
      setActionMessage(response.message || 'Forum manager invite sent.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setActionKey('');
    }
  };

  const handleTransferOwnership = async (event) => {
    event.preventDefault();
    if (!selectedForumId) {
      return;
    }
    if (!window.confirm('Transfer ownership? The new owner will become the primary forum owner immediately.')) {
      return;
    }

    setActionKey('transfer-ownership');
    setActionMessage('');
    setActionError('');
    try {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiTransferForumOwnership(selectedForumId, { identifier: transferIdentifier }, token);
      await onLoadForums?.();
      await refreshSelectedForum();
      setTransferIdentifier('');
      setActionMessage(response.message || 'Forum ownership transferred.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action failed.');
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
      setActionMessage('Forum details are already up to date.');
      setActionError('');
      return;
    }

    setActionKey('save-overview');
    setActionMessage('');
    setActionError('');
    try {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiUpdateForumDetails(selectedForumId, {
        description: overviewDraft,
        showCodeBlockTools: showCodeBlockToolsDraft
      }, token);
      await onLoadForums?.();
      await refreshSelectedForum();
      setActionMessage(response.message || 'Forum details updated.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update forum details.');
    } finally {
      setActionKey('');
    }
  };

  const addSectionDraftValue = () => {
    const normalizedSection = normalizeSectionInput(sectionDraft);
    if (!normalizedSection) {
      setActionError('Enter a valid section name first.');
      setActionMessage('');
      return;
    }
    if (sectionScopeDraft.includes(normalizedSection)) {
      setActionError('That section already exists in this forum.');
      setActionMessage('');
      return;
    }

    setSectionScopeDraft((current) => mergeSectionIntoScope(current, normalizedSection));
    setSectionDraft('');
    setActionError('');
  };

  const removeSectionDraftValue = (sectionValue) => {
    if (sectionScopeDraft.length <= 1) {
      setActionError('A forum must keep at least one section.');
      setActionMessage('');
      return;
    }

    setSectionScopeDraft((current) => current.filter((value) => value !== sectionValue));
    setActionError('');
  };

  const cancelSectionChanges = () => {
    setSectionScopeDraft(activeForum?.sectionScope || []);
    setSectionDraft('');
    setActionError('');
  };

  const handleSaveSections = async () => {
    if (!selectedForumId) {
      return;
    }

    const pendingSection = normalizeSectionInput(sectionDraft);
    if (sectionDraft.trim() && !pendingSection) {
      setActionError('Enter letters or numbers for the section name.');
      setActionMessage('');
      return;
    }

    const nextScope = pendingSection
      ? mergeSectionIntoScope(sectionScopeDraft, pendingSection)
      : sectionScopeDraft;

    if (nextScope.length === 0) {
      setActionError('A forum must keep at least one section.');
      setActionMessage('');
      return;
    }

    if (scopesMatch(nextScope, activeForum?.sectionScope || [])) {
      setSectionDraft('');
      setActionError('');
      return;
    }

    setActionKey('save-sections');
    setActionMessage('');
    setActionError('');
    try {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiUpdateForumSections(selectedForumId, { sectionScope: nextScope }, token);
      await onLoadForums?.();
      await refreshSelectedForum();
      setSectionScopeDraft(nextScope);
      setSectionDraft('');
      setActionMessage(response.message || 'Forum sections updated.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update forum sections.');
    } finally {
      setActionKey('');
    }
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
          <div className="forum-actions my-forums-header-actions">
            <Link to="/forums/request" className="forum-primary-btn text-decoration-none">
              Apply for a Forum
            </Link>
            <Link to="/forums/request/history" className="forum-secondary-btn text-decoration-none">
              Request History
            </Link>
            <Link to="/forum" className="forum-secondary-btn text-decoration-none">
              Back to Forum
            </Link>
          </div>
        </div>

        {actionError && <div className="settings-alert is-error mb-3">{actionError}</div>}
        {actionMessage && <div className="settings-alert is-success mb-3">{actionMessage}</div>}

        {manageableForums.length === 0 ? (
          <section className="settings-card">
            <h4 className="mb-2">No manageable forums yet</h4>
            <p className="muted mb-3">
              Once you own a forum or accept a forum manager invite, it will show up here.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <Link to="/my-forums/invitations" className="forum-secondary-btn text-decoration-none">
                {inviteInboxLoading ? 'Manager Invitations' : `Manager Invitations${incomingInvites.length > 0 ? ` (${incomingInvites.length})` : ''}`}
              </Link>
              <Link to="/forums/request" className="forum-primary-btn text-decoration-none">
                Apply for a Forum
              </Link>
              <Link to="/forums/request/history" className="forum-secondary-btn text-decoration-none">
                Request History
              </Link>
            </div>
          </section>
        ) : (
          <div className="forum-admin-layout">
            <aside className="forum-admin-sidebar">
              <Link
                to="/my-forums/invitations"
                className={`forum-admin-forum-card forum-admin-invite-link ${incomingInvites.length > 0 ? 'has-pending' : ''} text-decoration-none`.trim()}
              >
                <div className="forum-follow-card-topline">
                  <span className="forum-tag">Requests</span>
                  {incomingInvites.length > 0 && (
                    <span className="forum-admin-invite-badge">{incomingInvites.length}</span>
                  )}
                </div>
                <strong>Manager Invitations</strong>
                <p className="muted mb-0">
                  {inviteInboxLoading ? 'Loading pending invitations...' : 'Open a dedicated page to review pending forum manager invites.'}
                </p>
                <span className="forum-follow-meta">
                  {incomingInvites.length > 0 ? `${incomingInvites.length} pending review` : 'No pending invites'}
                </span>
              </Link>

              <section className="forum-admin-panel forum-admin-selector-card">
                <div className="forum-admin-panel-head">
                  <div>
                    <h5 className="mb-1">Owned or Managed Forums</h5>
                    <p className="muted mb-0">Search first, then choose a forum from the dropdown.</p>
                  </div>
                </div>

                <div className="forum-admin-selector-tools">
                  <label className="w-100">
                    <span className="form-label">Search</span>
                    <input
                      className="form-control forum-input"
                      value={forumSearchQuery}
                      onChange={(event) => setForumSearchQuery(event.target.value)}
                      placeholder="Search by forum name, role, or section"
                    />
                  </label>

                  <label className="w-100">
                    <span className="form-label">Forum</span>
                    <Select
                      options={forumSelectOptions}
                      value={selectedForumId}
                      onChange={setSelectedForumId}
                      placeholder={forumSelectOptions.length ? 'Choose a forum' : 'No matching forums'}
                      disabled={forumSelectOptions.length === 0}
                    />
                  </label>
                </div>

                <div className="forum-admin-selector-status">
                  <span className="muted">
                    {filteredManageableForums.length} match{filteredManageableForums.length === 1 ? '' : 'es'}
                  </span>
                  {forumSearchQuery.trim() && (
                    <button
                      type="button"
                      className="forum-secondary-btn"
                      onClick={() => setForumSearchQuery('')}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {selectedForum && (
                  <div className="forum-admin-current-card">
                    <div className="forum-follow-card-topline">
                      <span className="forum-tag">{selectedForum.isOwner ? 'Owner' : 'Manager'}</span>
                      <span className="muted">{selectedForum.followerCount ?? 0} followers</span>
                    </div>
                    <strong>{selectedForum.name}</strong>
                    <p className="muted mb-0">{selectedForum.description || 'Manage this forum from here.'}</p>
                    <span className="forum-follow-meta">
                      {(selectedForum.sectionScope || []).slice(0, 4).map((section) => getSectionLabel(section)).join(' / ') || 'No sections'}
                    </span>
                    <span className="forum-follow-meta">
                      {selectedForum.isOwner
                        ? 'Owner'
                        : currentUser?.isAdmin
                          ? 'Site admin'
                          : `${(selectedForum.currentUserPermissions || []).length} permissions`}
                    </span>
                  </div>
                )}
              </section>

              {false && manageableForums.map((forum) => {
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
                      {(forum.sectionScope || []).slice(0, 4).map((section) => getSectionLabel(section)).join(' · ') || 'No sections'}
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
                        <span className="forum-tag">{activeForum?.isOwner ? 'Owner Access' : 'Forum Manager'}</span>
                        <span className="muted">{activeForum?.livePostCount ?? activeForum?.postCount ?? 0} posts</span>
                      </div>
                      <h4 className="mb-1">{activeForum?.name}</h4>
                      <p className="muted mb-2">
                        {activeForum?.description || 'Manage your team access and forum responsibilities here.'}
                      </p>
                    </div>
                    <div className="forum-actions">
                      <Link to={`/forum/${activeForum?.slug}`} className="forum-primary-btn text-decoration-none">
                        Open Forum
                      </Link>
                      {canViewFollowers && (
                        <Link to={`/forum/${activeForum?.slug}/followers`} className="forum-secondary-btn text-decoration-none">
                          View Followers
                        </Link>
                      )}
                    </div>
                  </div>

                  {accessMessage && <div className="settings-alert is-error mb-3">{accessMessage}</div>}

                  {accessLoading && !selectedAccess ? (
                    <p className="muted mb-0">Loading forum access...</p>
                  ) : selectedAccess ? (
                    <div className="forum-admin-sections">
                      <section className="forum-admin-panel">
                        <div className="forum-admin-panel-head">
                          <div>
                            <h5 className="mb-1">Forum Details</h5>
                            <p className="muted mb-0">
                              {canManageForumDetails
                                ? 'Edit the forum overview and keep the accepted section scope up to date here.'
                                : 'You can review the current overview and section scope here.'}
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
                              placeholder="Write a short overview for this forum."
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
                              <small>Turn this off for forums that do not need the language picker and quick code insert tool.</small>
                            </span>
                          </label>
                          {canManageForumDetails && (
                            <button
                              type="submit"
                              className="forum-primary-btn"
                              disabled={actionKey === 'save-overview'}
                            >
                              {actionKey === 'save-overview' ? 'Saving...' : 'Save Details'}
                            </button>
                          )}
                        </form>

                        <div className="forum-admin-panel-head mt-3">
                          <div>
                            <h5 className="mb-1">Edit Sections</h5>
                            <p className="muted mb-0">
                              {canManageForumDetails
                                ? 'Add new sections or remove ones the forum no longer needs.'
                                : 'Current sections accepted by this forum.'}
                            </p>
                          </div>
                        </div>

                        {canManageForumDetails && (
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
                        )}

                        <div className="section-chip-wrap">
                          {(canManageForumDetails ? sectionScopeDraft : (activeForum?.sectionScope || [])).map((section) => (
                            <div key={section} className={`section-chip-row ${canManageForumDetails ? 'is-editing' : ''}`.trim()}>
                              <span className="section-chip is-active">
                                <span>{getSectionLabel(section)}</span>
                              </span>
                              {canManageForumDetails && (
                                <button
                                  type="button"
                                  className="section-chip-remove"
                                  onClick={() => removeSectionDraftValue(section)}
                                  disabled={actionKey === 'save-sections'}
                                  aria-label={`Remove ${getSectionLabel(section)}`}
                                >
                                  x
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {canManageForumDetails && (
                          <div className="forum-section-admin-actions mt-3">
                            <button
                              type="button"
                              className="forum-primary-btn"
                              onClick={handleSaveSections}
                              disabled={actionKey === 'save-sections'}
                            >
                              {actionKey === 'save-sections' ? 'Saving...' : 'Save'}
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
                        )}
                      </section>

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
                            <h5 className="mb-1">Forum Managers</h5>
                            <p className="muted mb-0">
                              {canManageAdmins
                                ? 'Add managers here, then open a manager profile to update detailed permissions.'
                                : 'You can view the team here, but only someone with admin-management permission can change it.'}
                            </p>
                          </div>
                        </div>

                        {canManageAdmins && (
                          <form className="forum-admin-create-form" onSubmit={handleInviteManager}>
                            <label className="w-100">
                              <span className="form-label">Invite a forum manager</span>
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
                                    onChange={() => setInvitePermissions((current) => current.includes(permission.key)
                                      ? current.filter((item) => item !== permission.key)
                                      : [...current, permission.key])}
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
                              {actionKey === 'invite-manager' ? 'Sending...' : 'Send Manager Invite'}
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
                                    <Link to={`/my-forums/${selectedForum.id}/managers/${manager.id}`} className="forum-secondary-btn text-decoration-none">
                                      Manage
                                    </Link>
                                  )}
                                </div>
                                <p className="muted mb-0">{(manager.permissions || []).length} permissions assigned.</p>
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
