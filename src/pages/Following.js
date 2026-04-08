import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  apiGetFollowing,
  apiUnfollowForum,
  apiUnfollowUser,
  resolveMediaSource
} from '../api';
import Avatar from '../components/Avatar';
import { authStorage } from '../lib/authStorage';
import { getSectionLabel } from '../lib/sections';

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'audience', label: 'Largest audience' },
  { value: 'name', label: 'Name A-Z' }
];

function formatCount(value) {
  const count = Number(value || 0);
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getLastActivityLabel(timestamp) {
  const value = Number(timestamp || 0);
  if (!value) {
    return 'No recent activity';
  }

  const diffHours = (Date.now() - value) / 36e5;
  if (diffHours <= 24) {
    return 'Active today';
  }
  if (diffHours <= 24 * 7) {
    return 'Active this week';
  }
  return `Updated ${new Date(value).toLocaleDateString()}`;
}

function resolveActiveType(searchParams) {
  const legacyTab = normalizeText(searchParams.get('tab'));
  const modernType = normalizeText(searchParams.get('type'));
  const value = modernType || legacyTab;

  if (value === 'spaces' || value === 'forums') {
    return 'spaces';
  }
  if (value === 'creators' || value === 'following') {
    return 'creators';
  }
  return 'all';
}

function sortCreators(items, sortMode) {
  return [...items].sort((left, right) => {
    if (sortMode === 'name') {
      return String(left.name || '').localeCompare(String(right.name || ''));
    }
    if (sortMode === 'audience') {
      return Number(right.followerCount || 0) - Number(left.followerCount || 0)
        || Number(right.followingCount || 0) - Number(left.followingCount || 0)
        || String(left.name || '').localeCompare(String(right.name || ''));
    }
    return Number(right.lastActiveAt || 0) - Number(left.lastActiveAt || 0)
      || Number(right.followerCount || 0) - Number(left.followerCount || 0)
      || String(left.name || '').localeCompare(String(right.name || ''));
  });
}

function sortSpaces(items, sortMode) {
  return [...items].sort((left, right) => {
    if (sortMode === 'name') {
      return String(left.name || '').localeCompare(String(right.name || ''));
    }
    if (sortMode === 'audience') {
      return Number(right.followerCount || 0) - Number(left.followerCount || 0)
        || Number(right.livePostCount || right.postCount || 0) - Number(left.livePostCount || left.postCount || 0)
        || String(left.name || '').localeCompare(String(right.name || ''));
    }

    const leftActivity = Number(left.latestActivityAt || left.updatedAt || 0);
    const rightActivity = Number(right.latestActivityAt || right.updatedAt || 0);
    return rightActivity - leftActivity
      || Number(right.livePostCount || right.postCount || 0) - Number(left.livePostCount || left.postCount || 0)
      || String(left.name || '').localeCompare(String(right.name || ''));
  });
}

function FollowingCreatorCard({ creator, pending, onUnfollow }) {
  return (
    <article className="following-card">
      <div className="following-card-head">
        <Link to={`/users/${creator.id}`} className="following-creator-anchor">
          <Avatar
            imageUrl={resolveMediaSource(creator.avatarUrl)}
            name={creator.name}
            size={40}
            className="following-creator-avatar"
          />
          <span className="following-card-head-copy">
            <strong>{creator.name}</strong>
            <span>{getLastActivityLabel(creator.lastActiveAt)}</span>
          </span>
        </Link>

        <button
          type="button"
          className="forum-secondary-btn following-unfollow-btn"
          onClick={() => onUnfollow(creator)}
          disabled={pending}
        >
          {pending ? 'Updating...' : 'Unfollow'}
        </button>
      </div>

      <p className="following-card-description mb-0">
        {creator.bio || 'Creator sharing ideas, practical builds, and updates.'}
      </p>

      <div className="following-card-meta">
        <span>{formatCount(creator.followerCount)} followers</span>
        <span>{formatCount(creator.followingCount)} following</span>
      </div>

      <div className="following-card-actions">
        <Link to={`/users/${creator.id}`} className="following-link-btn">View profile</Link>
      </div>
    </article>
  );
}

function FollowingSpaceCard({ forum, pending, onUnfollow }) {
  const sectionSummary = (forum.sectionScope || []).map((section) => getSectionLabel(section)).slice(0, 3).join(' | ');
  return (
    <article className="following-card">
      <div className="following-card-head">
        <Link to={`/forum/${forum.slug}`} className="following-space-anchor">
          <span className="following-space-avatar" aria-hidden="true">
            {String(forum.name || '').trim().charAt(0).toUpperCase() || 'S'}
          </span>
          <span className="following-card-head-copy">
            <strong>{forum.name}</strong>
            <span>{getLastActivityLabel(forum.latestActivityAt || forum.updatedAt || 0)}</span>
          </span>
        </Link>

        <button
          type="button"
          className="forum-secondary-btn following-unfollow-btn"
          onClick={() => onUnfollow(forum)}
          disabled={pending}
        >
          {pending ? 'Updating...' : 'Unfollow'}
        </button>
      </div>

      <p className="following-card-description mb-0">
        {forum.description || 'Space you follow for ongoing community discussions.'}
      </p>

      <div className="following-card-meta">
        <span>{formatCount(forum.followerCount || 0)} followers</span>
        <span>{formatCount(forum.livePostCount || forum.postCount || 0)} posts</span>
        <span>{(forum.sectionScope || []).length} sections</span>
      </div>

      {sectionSummary ? (
        <p className="following-card-section-summary mb-0" title={sectionSummary}>
          {sectionSummary}
        </p>
      ) : null}

      <div className="following-card-actions">
        <Link to={`/forum/${forum.slug}`} className="following-link-btn">View space</Link>
      </div>
    </article>
  );
}

export default function Following({ forums = [], currentUser, onLoadForums }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [refineQuery, setRefineQuery] = useState('');
  const [sortMode, setSortMode] = useState('recent');
  const [followedCreators, setFollowedCreators] = useState([]);
  const [networkPosts, setNetworkPosts] = useState([]);
  const [pendingCreatorId, setPendingCreatorId] = useState('');
  const [pendingForumId, setPendingForumId] = useState('');
  const [locallyHiddenForumIds, setLocallyHiddenForumIds] = useState(() => new Set());

  const activeType = resolveActiveType(searchParams);
  const normalizedQuery = normalizeText(refineQuery);

  const creatorActivityMap = useMemo(() => {
    const nextMap = new Map();
    networkPosts.forEach((post) => {
      const authorId = String(post?.authorId || '').trim();
      const activityAt = Number(post?.updatedAt || post?.createdAt || 0);
      if (!authorId || !activityAt) {
        return;
      }
      nextMap.set(authorId, Math.max(nextMap.get(authorId) || 0, activityAt));
    });
    return nextMap;
  }, [networkPosts]);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowing() {
      setLoading(true);
      setFeedback({ type: '', text: '' });

      try {
        const token = authStorage.getToken();
        if (!token) {
          throw new Error('Please login first.');
        }

        const data = await apiGetFollowing(token);
        if (cancelled) {
          return;
        }

        const followingUsers = (data.following || data.users || [])
          .filter((item) => String(item?.id || '').trim().length > 0)
          .filter((item) => String(item.id) !== String(currentUser?.id || ''))
          .map((item) => ({
            ...item,
            isFollowing: item.isFollowing !== false
          }))
          .filter((item) => item.isFollowing);

        setFollowedCreators(followingUsers);
        setNetworkPosts(data.posts || []);
      } catch (error) {
        if (!cancelled) {
          setFollowedCreators([]);
          setNetworkPosts([]);
          setFeedback({
            type: 'error',
            text: error instanceof Error ? error.message : 'Failed to load following data.'
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadFollowing();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const followedSpaces = useMemo(() => {
    return forums.filter((forum) => Boolean(forum?.isFollowing) && !locallyHiddenForumIds.has(String(forum?.id || '')));
  }, [forums, locallyHiddenForumIds]);

  const visibleCreators = useMemo(() => {
    const filtered = followedCreators
      .map((creator) => ({
        ...creator,
        lastActiveAt: creatorActivityMap.get(String(creator.id || '').trim()) || 0
      }))
      .filter((creator) => {
        if (!normalizedQuery) {
          return true;
        }
        return [
          creator.name,
          creator.bio,
          creator.email
        ].some((value) => normalizeText(value).includes(normalizedQuery));
      });

    return sortCreators(filtered, sortMode);
  }, [creatorActivityMap, followedCreators, normalizedQuery, sortMode]);

  const visibleSpaces = useMemo(() => {
    const filtered = followedSpaces.filter((forum) => {
      if (!normalizedQuery) {
        return true;
      }
      const sectionBlob = (forum.sectionScope || []).map((section) => getSectionLabel(section)).join(' ');
      return [
        forum.name,
        forum.description,
        sectionBlob
      ].some((value) => normalizeText(value).includes(normalizedQuery));
    });
    return sortSpaces(filtered, sortMode);
  }, [followedSpaces, normalizedQuery, sortMode]);

  const hasAnyFollowed = visibleCreators.length > 0 || visibleSpaces.length > 0 || followedCreators.length > 0 || followedSpaces.length > 0;

  const visibleCount = useMemo(() => {
    if (activeType === 'creators') {
      return visibleCreators.length;
    }
    if (activeType === 'spaces') {
      return visibleSpaces.length;
    }
    return visibleCreators.length + visibleSpaces.length;
  }, [activeType, visibleCreators.length, visibleSpaces.length]);

  const switchType = useCallback((typeValue) => {
    if (typeValue === 'all') {
      setSearchParams({});
      return;
    }
    setSearchParams({ type: typeValue });
  }, [setSearchParams]);

  const handleUnfollowCreator = useCallback(async (creator) => {
    const token = authStorage.getToken();
    if (!token) {
      setFeedback({ type: 'error', text: 'Please login first.' });
      return;
    }

    setPendingCreatorId(String(creator.id || ''));
    try {
      await apiUnfollowUser(creator.id, token);
      setFollowedCreators((current) => current.filter((item) => item.id !== creator.id));
      setFeedback({ type: 'success', text: `Unfollowed ${creator.name}.` });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update follow state.'
      });
    } finally {
      setPendingCreatorId('');
    }
  }, []);

  const handleUnfollowSpace = useCallback(async (forum) => {
    const token = authStorage.getToken();
    if (!token) {
      setFeedback({ type: 'error', text: 'Please login first.' });
      return;
    }
    if (!forum?.id) {
      setFeedback({ type: 'error', text: 'This space is unavailable right now.' });
      return;
    }

    setPendingForumId(String(forum.id));
    try {
      await apiUnfollowForum(forum.id, token);
      setLocallyHiddenForumIds((current) => {
        const next = new Set(current);
        next.add(String(forum.id));
        return next;
      });
      setFeedback({ type: 'success', text: `Unfollowed ${forum.name}.` });
      if (typeof onLoadForums === 'function') {
        await onLoadForums();
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update follow state.'
      });
    } finally {
      setPendingForumId('');
    }
  }, [onLoadForums]);

  if (loading) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <p className="muted mb-0">Loading your following library...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <section className="following-page-shell">
        <header className="following-header">
          <div>
            <h1 className="community-feed-title mb-1">Following</h1>
            <p className="my-posts-subtext mb-0">Creators and spaces you follow.</p>
          </div>
          <span className="community-feed-count">
            {visibleCount} visible
          </span>
        </header>

        <section className="community-feed-control-bar following-control-row" aria-label="Following controls">
          <label className="community-feed-control community-feed-control-search">
            <span className="community-feed-control-label">Refine results</span>
            <div className="community-feed-search">
              <input
                className="form-control forum-input tag-search-input"
                value={refineQuery}
                onChange={(event) => setRefineQuery(event.target.value)}
                placeholder="Refine followed creators and spaces"
                aria-label="Refine followed results"
              />
              {refineQuery ? (
                <button
                  type="button"
                  className="community-feed-search-clear"
                  onClick={() => setRefineQuery('')}
                  aria-label="Clear refine results"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </label>

          <label className="community-feed-control">
            <span className="community-feed-control-label">
              {SORT_OPTIONS.find((option) => option.value === sortMode)?.label || 'Most recent'}
            </span>
            <div className="forum-native-select-wrap">
              <select
                className="forum-native-select"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </label>
        </section>

        <nav className="following-segmented" aria-label="Follow type">
          <button
            type="button"
            className={`following-segment-btn ${activeType === 'all' ? 'is-active' : ''}`.trim()}
            onClick={() => switchType('all')}
          >
            <span>All</span>
            <strong>{visibleCreators.length + visibleSpaces.length}</strong>
          </button>
          <button
            type="button"
            className={`following-segment-btn ${activeType === 'creators' ? 'is-active' : ''}`.trim()}
            onClick={() => switchType('creators')}
          >
            <span>Creators</span>
            <strong>{visibleCreators.length}</strong>
          </button>
          <button
            type="button"
            className={`following-segment-btn ${activeType === 'spaces' ? 'is-active' : ''}`.trim()}
            onClick={() => switchType('spaces')}
          >
            <span>Spaces</span>
            <strong>{visibleSpaces.length}</strong>
          </button>
        </nav>

        {feedback.text ? (
          <div className={`settings-alert ${feedback.type === 'error' ? 'is-error' : 'is-success'} mb-0`}>
            {feedback.text}
          </div>
        ) : null}

        {!hasAnyFollowed ? (
          <section className="following-empty-state">
            <h2 className="my-posts-empty-title mb-0">You are not following anyone yet</h2>
            <p className="my-posts-empty-copy mb-0">Follow creators and spaces to build your personal library here.</p>
            <div className="my-posts-empty-actions">
              <Link to="/explore" className="forum-primary-btn text-decoration-none">
                Discover creators and spaces
              </Link>
            </div>
          </section>
        ) : (
          <>
            {(activeType === 'all' || activeType === 'creators') && visibleCreators.length > 0 ? (
              <section className="following-section">
                {activeType === 'all' ? (
                  <div className="following-section-head">
                    <h2 className="following-section-title mb-0">Followed Creators</h2>
                    <span className="following-section-count">{visibleCreators.length}</span>
                  </div>
                ) : null}
                <div className="following-grid following-grid-creators">
                  {visibleCreators.map((creator) => (
                    <FollowingCreatorCard
                      key={`creator-${creator.id}`}
                      creator={creator}
                      pending={pendingCreatorId === String(creator.id)}
                      onUnfollow={handleUnfollowCreator}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {(activeType === 'all' || activeType === 'spaces') && visibleSpaces.length > 0 ? (
              <section className="following-section">
                {activeType === 'all' ? (
                  <div className="following-section-head">
                    <h2 className="following-section-title mb-0">Followed Spaces</h2>
                    <span className="following-section-count">{visibleSpaces.length}</span>
                  </div>
                ) : null}
                <div className="following-grid following-grid-spaces">
                  {visibleSpaces.map((forum) => (
                    <FollowingSpaceCard
                      key={`space-${forum.id || forum.slug}`}
                      forum={forum}
                      pending={pendingForumId === String(forum.id)}
                      onUnfollow={handleUnfollowSpace}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {visibleCount === 0 ? (
              <section className="following-empty-state">
                <h2 className="my-posts-empty-title mb-0">No results in this view</h2>
                <p className="my-posts-empty-copy mb-0">Try a different filter, segment, or clear refine results.</p>
              </section>
            ) : null}

            <section className="following-discover-cta">
              <div>
                <h3 className="following-discover-cta-title mb-1">Discover more creators and spaces</h3>
                <p className="following-discover-cta-copy mb-0">
                  Expand your library with recommendations tailored to your interests.
                </p>
              </div>
              <Link to="/explore" className="forum-secondary-btn text-decoration-none">
                Go to Discover
              </Link>
            </section>
          </>
        )}
      </section>
    </div>
  );
}
