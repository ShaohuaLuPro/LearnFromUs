import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGetForumManagerInvites } from '../api';
import { authStorage } from '../lib/authStorage';
import { getSectionLabel } from '../lib/sections';

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' }
];

const SORT_OPTIONS = [
  { value: 'activity', label: 'Most active' },
  { value: 'followers', label: 'Most followers' },
  { value: 'name', label: 'Name A-Z' }
];

function renderNativeSelectOptions(options) {
  return options.map((item) => (
    <option key={item.value} value={item.value}>
      {item.label}
    </option>
  ));
}

function isOwnerSpace(forum, userId) {
  return Boolean(forum.isOwner || (forum.ownerId && forum.ownerId === userId));
}

function sortSpaces(items, sortMode) {
  return [...items].sort((left, right) => {
    if (sortMode === 'name') {
      return String(left.name || '').localeCompare(String(right.name || ''));
    }

    if (sortMode === 'followers') {
      return Number(right.followerCount || 0) - Number(left.followerCount || 0)
        || String(left.name || '').localeCompare(String(right.name || ''));
    }

    return Number(right.livePostCount || right.postCount || 0) - Number(left.livePostCount || left.postCount || 0)
      || Number(right.followerCount || 0) - Number(left.followerCount || 0)
      || String(left.name || '').localeCompare(String(right.name || ''));
  });
}

function buildRoleLabel(forum, currentUser) {
  if (isOwnerSpace(forum, currentUser?.id)) {
    return 'Owner';
  }
  return 'Admin';
}

export default function MyForums({ currentUser, forums = [], onLoadForums }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortMode, setSortMode] = useState('activity');
  const [inviteCount, setInviteCount] = useState(0);
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    if (typeof onLoadForums === 'function') {
      void onLoadForums();
    }
  }, [onLoadForums]);

  useEffect(() => {
    let cancelled = false;

    async function loadInvites() {
      if (!currentUser) {
        setInviteCount(0);
        return;
      }

      const token = authStorage.getToken();
      if (!token) {
        setInviteCount(0);
        return;
      }

      setInviteLoading(true);
      try {
        const data = await apiGetForumManagerInvites(token);
        if (!cancelled) {
          setInviteCount((data.invites || []).length);
        }
      } catch (_) {
        if (!cancelled) {
          setInviteCount(0);
        }
      } finally {
        if (!cancelled) {
          setInviteLoading(false);
        }
      }
    }

    loadInvites();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const manageableSpaces = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.isAdmin) {
      return forums;
    }

    return forums.filter((forum) => forum.ownerId === currentUser.id || forum.canManage);
  }, [currentUser, forums]);

  const filteredSpaces = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = manageableSpaces.filter((forum) => {
      const matchesRole = roleFilter === 'all'
        || (roleFilter === 'owner' && isOwnerSpace(forum, currentUser?.id))
        || (roleFilter === 'admin' && !isOwnerSpace(forum, currentUser?.id));
      if (!matchesRole) {
        return false;
      }

      if (!query) {
        return true;
      }

      const sectionText = (forum.sectionScope || []).map((section) => getSectionLabel(section)).join(' ');
      return [
        forum.name,
        forum.description,
        sectionText,
        buildRoleLabel(forum, currentUser)
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });

    return sortSpaces(filtered, sortMode);
  }, [currentUser, manageableSpaces, roleFilter, searchQuery, sortMode]);

  if (!currentUser) {
    return (
      <div className="container page-shell">
        <section className="panel my-spaces-panel">
          <h2 className="mb-2 type-title-md">My Spaces</h2>
          <p className="muted mb-3">Login to view spaces you own or help manage.</p>
          <Link to="/login" className="forum-primary-btn text-decoration-none">Login</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <section className="my-spaces-panel" aria-label="My spaces">
        <header className="my-spaces-header">
          <div>
            <h1 className="community-feed-title mb-1">My Spaces</h1>
            <p className="my-posts-subtext mb-0">Browse your owned and managed communities, then open a dedicated workspace to configure each one.</p>
          </div>
          <span className="community-feed-count">
            {filteredSpaces.length}
            {manageableSpaces.length !== filteredSpaces.length ? ` of ${manageableSpaces.length}` : ''} spaces
          </span>
        </header>

        <div className="my-spaces-toolbar-row">
          <Link to="/forums/request" className="forum-primary-btn text-decoration-none">
            Request a Space
          </Link>
          <Link to="/forums/request/history" className="forum-secondary-btn text-decoration-none">
            Request History
          </Link>
          <Link
            to="/my-spaces/invitations"
            className={`forum-secondary-btn text-decoration-none ${inviteCount > 0 ? 'is-highlighted' : ''}`.trim()}
          >
            {inviteLoading ? 'Inbox' : `Inbox${inviteCount > 0 ? ` (${inviteCount})` : ''}`}
          </Link>
        </div>

        <section className="community-feed-control-bar my-spaces-control-bar" aria-label="My spaces controls">
          <label className="community-feed-control">
            <span className="community-feed-control-label">Role</span>
            <div className="forum-native-select-wrap">
              <select
                className="forum-native-select"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                {renderNativeSelectOptions(ROLE_FILTER_OPTIONS)}
              </select>
            </div>
          </label>

          <label className="community-feed-control">
            <span className="community-feed-control-label">Sort</span>
            <div className="forum-native-select-wrap">
              <select
                className="forum-native-select"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value)}
              >
                {renderNativeSelectOptions(SORT_OPTIONS)}
              </select>
            </div>
          </label>

          <div className="community-feed-search">
            <input
              className="form-control forum-input tag-search-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Refine spaces"
            />
            {searchQuery && (
              <button
                type="button"
                className="community-feed-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear refine spaces input"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {manageableSpaces.length === 0 ? (
          <section className="settings-card my-spaces-empty-state">
            <h2 className="my-posts-empty-title mb-0">No spaces yet</h2>
            <p className="my-posts-empty-copy mb-0">
              Create or join a space and it will appear here for quick access.
            </p>
            <div className="my-posts-empty-actions">
              <Link to="/forums/request" className="forum-primary-btn text-decoration-none">
                Request your first space
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="my-spaces-results-head">
              <p className="muted mb-0">
                Listing and selection only. Open a space workspace to edit details, sections, managers, and permissions.
              </p>
              <Link
                to="/my-spaces/invitations"
                className={`my-spaces-invite-link ${inviteCount > 0 ? 'has-pending' : ''}`.trim()}
              >
                {inviteCount > 0 ? `${inviteCount} pending actions` : 'Open inbox'}
              </Link>
            </div>

            <div className="my-spaces-grid">
              {filteredSpaces.map((forum) => {
                const sectionLabels = (forum.sectionScope || []).map((section) => getSectionLabel(section));
                const roleLabel = buildRoleLabel(forum, currentUser);
                const postVolume = Number(forum.livePostCount || forum.postCount || 0);
                const followerVolume = Number(forum.followerCount || 0);

                return (
                  <article key={forum.id} className="my-space-card">
                    <div className="my-space-card-head">
                      <span className="my-space-avatar" aria-hidden="true">
                        {String(forum.name || '').trim().charAt(0).toUpperCase() || 'S'}
                      </span>
                      <div className="my-space-card-head-copy">
                        <strong title={forum.name}>{forum.name}</strong>
                      </div>
                      <span className="my-space-role-pill">{roleLabel}</span>
                    </div>

                    <p className="my-space-card-description mb-0">
                      {forum.description || 'No description yet.'}
                    </p>

                    <div className="my-space-card-meta">
                      <span className="my-space-meta-pill">{followerVolume} followers</span>
                      <span className="my-space-meta-pill">{postVolume} posts</span>
                      <span className="my-space-meta-pill">{sectionLabels.length} sections</span>
                    </div>

                    <p className="my-space-card-description mb-0" title={sectionLabels.join(' | ')}>
                      {sectionLabels.slice(0, 3).join(' | ') || 'No sections configured'}
                    </p>

                    <div className="my-space-card-actions">
                      <Link to={`/forum/${forum.slug}`} className="forum-secondary-btn text-decoration-none">
                        View Space
                      </Link>
                      <Link to={`/my-spaces/${forum.id}/manage`} className="forum-primary-btn text-decoration-none">
                        Manage
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            {filteredSpaces.length === 0 ? (
              <section className="settings-card my-spaces-empty-state">
                <h2 className="my-posts-empty-title mb-0">No spaces match this view</h2>
                <p className="my-posts-empty-copy mb-0">
                  Adjust your filters or clear refine results to see the full list.
                </p>
              </section>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
