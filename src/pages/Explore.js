import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiFollowForum,
  apiFollowUser,
  apiGetFollowing,
  resolveMediaSource
} from '../api';
import Avatar from '../components/Avatar';
import ForumSectionPills from '../components/ForumSectionPills';
import { authStorage } from '../lib/authStorage';
import { buildForumDirectory, sortByRecentActivity } from '../lib/forumInsights';
import { getSectionLabel, getSectionValues } from '../lib/sections';

const DISCOVER_SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'active', label: 'Most active' },
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' }
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

function getForumKey(forum) {
  return String(forum?.id || forum?.slug || '').trim();
}

function getActivityLabel(timestamp) {
  const activityAt = Number(timestamp || 0);
  if (!activityAt) {
    return 'Recently active';
  }

  const diffHours = (Date.now() - activityAt) / 36e5;
  if (diffHours <= 24) {
    return 'Active today';
  }
  if (diffHours <= 72) {
    return 'Active this week';
  }
  return `Updated ${new Date(activityAt).toLocaleDateString()}`;
}

function toUserMeta(user) {
  return {
    id: String(user?.id || '').trim(),
    bio: String(user?.bio || '').trim(),
    avatarUrl: String(user?.avatarUrl || '').trim(),
    followerCount: Number(user?.followerCount || 0),
    followingCount: Number(user?.followingCount || 0)
  };
}

function matchByQuery(query, ...fragments) {
  if (!query) {
    return true;
  }

  return fragments.some((fragment) => normalizeText(fragment).includes(query));
}

function CreatorCard({
  creator,
  pending,
  currentUser,
  onFollow
}) {
  return (
    <article className="discover-card discover-creator-card">
      <div className="discover-card-head">
        <Link to={`/users/${creator.id}`} className="discover-creator-anchor">
          <Avatar
            imageUrl={resolveMediaSource(creator.avatarUrl)}
            name={creator.name}
            size={40}
            className="discover-creator-avatar"
          />
          <span className="discover-creator-name-wrap">
            <span className="discover-creator-name">{creator.name}</span>
            <span className="discover-creator-meta">
              {formatCount(creator.postCount)} posts
              <span aria-hidden="true">·</span>
              {formatCount(creator.totalViews)} views
            </span>
          </span>
        </Link>
        <button
          type="button"
          className="forum-primary-btn discover-follow-btn"
          onClick={() => onFollow(creator)}
          disabled={pending}
        >
          {pending ? 'Following...' : 'Follow'}
        </button>
      </div>

      <p className="discover-card-description">
        {creator.bio || 'Creator sharing practical ideas, experiments, and live builds.'}
      </p>

      <div className="discover-card-foot">
        <span className="discover-card-reason">{creator.reason}</span>
        <span className="discover-card-meta">{getActivityLabel(creator.lastActiveAt)}</span>
      </div>

      {!currentUser && (
        <div className="discover-inline-note">Log in to follow creators inline.</div>
      )}
    </article>
  );
}

function SpaceCard({
  forum,
  pending,
  currentUser,
  onJoin
}) {
  return (
    <article className="discover-card discover-space-card">
      <div className="discover-card-head">
        <div className="discover-space-title-wrap">
          <span className="discover-space-avatar" aria-hidden="true">
            {String(forum.name || '').trim().charAt(0).toUpperCase() || 'S'}
          </span>
          <span className="discover-space-name-wrap">
            <Link to={`/forum/${forum.slug}`} className="discover-space-name-link">
              {forum.name}
            </Link>
            <span className="discover-space-meta">
              {formatCount(forum.livePostCount ?? forum.postCount ?? 0)} posts
              <span aria-hidden="true">·</span>
              {formatCount(forum.followerCount)} followers
            </span>
          </span>
        </div>

        <button
          type="button"
          className="forum-secondary-btn discover-join-btn"
          onClick={() => onJoin(forum)}
          disabled={pending}
        >
          {pending ? 'Joining...' : 'Join'}
        </button>
      </div>

      <p className="discover-card-description">
        {forum.description || 'Community space with active conversations and practical updates.'}
      </p>

      <ForumSectionPills
        sections={forum.sectionScope || []}
        visibleCount={3}
        className="discover-space-pill-group"
      />

      <div className="discover-card-foot">
        <span className="discover-card-reason">{forum.reason}</span>
        <span className="discover-card-meta">{getActivityLabel(forum.latestActivityAt)}</span>
      </div>

      {!currentUser && (
        <div className="discover-inline-note">Log in to join spaces inline.</div>
      )}
    </article>
  );
}

export default function Explore({ forums, posts, currentUser, onLoadForums }) {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('relevance');
  const [selectedInterest, setSelectedInterest] = useState('__all');
  const [pendingCreatorId, setPendingCreatorId] = useState('');
  const [pendingForumKey, setPendingForumKey] = useState('');
  const [networkLoading, setNetworkLoading] = useState(Boolean(currentUser));
  const [followedUserIds, setFollowedUserIds] = useState(() => new Set());
  const [knownUserMeta, setKnownUserMeta] = useState(() => new Map());
  const [localFollowedForumKeys, setLocalFollowedForumKeys] = useState(() => new Set());
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const forumDirectory = useMemo(() => buildForumDirectory(forums, posts), [forums, posts]);
  const searchQuery = normalizeText(search);
  const interestOptions = useMemo(() => {
    const sections = getSectionValues(forumDirectory.flatMap((forum) => forum.sectionScope || []));
    return sections.map((value) => ({ value, label: getSectionLabel(value) }));
  }, [forumDirectory]);

  useEffect(() => {
    let cancelled = false;

    async function loadNetwork() {
      if (!currentUser) {
        setNetworkLoading(false);
        setFollowedUserIds(new Set());
        setKnownUserMeta(new Map());
        return;
      }

      setNetworkLoading(true);
      try {
        const token = authStorage.getToken();
        if (!token) {
          if (!cancelled) {
            setFollowedUserIds(new Set());
            setKnownUserMeta(new Map());
          }
          return;
        }

        const network = await apiGetFollowing(token);
        if (cancelled) {
          return;
        }

        const following = network.following || network.users || [];
        const followers = network.followers || [];
        const followingSet = new Set(following.map((item) => String(item.id || '').trim()).filter(Boolean));

        const nextMeta = new Map();
        [...following, ...followers].forEach((item) => {
          const meta = toUserMeta(item);
          if (meta.id) {
            nextMeta.set(meta.id, meta);
          }
        });

        setFollowedUserIds(followingSet);
        setKnownUserMeta(nextMeta);
      } catch (_) {
        if (!cancelled) {
          setFollowedUserIds(new Set());
          setKnownUserMeta(new Map());
        }
      } finally {
        if (!cancelled) {
          setNetworkLoading(false);
        }
      }
    }

    loadNetwork();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const followedForumKeySet = useMemo(() => {
    const keys = new Set(localFollowedForumKeys);
    forumDirectory.forEach((forum) => {
      if (forum.isFollowing) {
        const key = getForumKey(forum);
        if (key) {
          keys.add(key);
        }
      }
    });
    return keys;
  }, [forumDirectory, localFollowedForumKeys]);

  const followedSectionSet = useMemo(() => {
    const values = new Set();
    forumDirectory.forEach((forum) => {
      if (!followedForumKeySet.has(getForumKey(forum))) {
        return;
      }
      (forum.sectionScope || []).forEach((section) => {
        const normalized = String(section || '').trim();
        if (normalized) {
          values.add(normalized);
        }
      });
    });
    return values;
  }, [followedForumKeySet, forumDirectory]);

  const creatorCandidates = useMemo(() => {
    const creators = new Map();
    posts.forEach((post) => {
      const authorId = String(post.authorId || '').trim();
      if (!authorId || authorId === currentUser?.id || followedUserIds.has(authorId)) {
        return;
      }

      const current = creators.get(authorId) || {
        id: authorId,
        name: post.authorName || 'Unknown creator',
        avatarUrl: post.authorAvatarUrl || '',
        postCount: 0,
        totalViews: 0,
        lastActiveAt: 0,
        sectionSet: new Set(),
        sharedFollowedSectionCount: 0
      };

      current.name = post.authorName || current.name;
      current.avatarUrl = post.authorAvatarUrl || current.avatarUrl;
      current.postCount += 1;
      current.totalViews += Number(post.viewCount || 0);
      current.lastActiveAt = Math.max(current.lastActiveAt, Number(post.updatedAt || post.createdAt || 0));

      const postSection = String(post.section || '').trim();
      if (postSection) {
        current.sectionSet.add(postSection);
      }

      creators.set(authorId, current);
    });

    return [...creators.values()].map((creator) => {
      const overlapCount = [...creator.sectionSet].filter((section) => followedSectionSet.has(section)).length;
      const sectionHint = [...creator.sectionSet][0] || '';
      const knownMeta = knownUserMeta.get(creator.id);
      const reason = overlapCount > 0
        ? `Popular in ${getSectionLabel([...creator.sectionSet].find((section) => followedSectionSet.has(section)) || sectionHint)}`
        : (Date.now() - creator.lastActiveAt) / 36e5 <= 72
          ? 'Active recently'
          : 'Consistently publishing';

      const relevanceScore = (
        overlapCount * 220
        + creator.postCount * 40
        + Math.log2(creator.totalViews + 1) * 64
        + Math.max(0, 120 - Math.min((Date.now() - creator.lastActiveAt) / 36e5, 120))
      );

      return {
        ...creator,
        bio: knownMeta?.bio || '',
        reason,
        sharedFollowedSectionCount: overlapCount,
        relevanceScore
      };
    });
  }, [currentUser?.id, followedSectionSet, followedUserIds, knownUserMeta, posts]);

  const spaceCandidates = useMemo(() => {
    return forumDirectory
      .filter((forum) => !followedForumKeySet.has(getForumKey(forum)))
      .map((forum) => {
        const sectionOverlap = (forum.sectionScope || []).filter((section) => followedSectionSet.has(section));
        const reason = sectionOverlap.length > 0
          ? `Related to ${getSectionLabel(sectionOverlap[0])}`
          : (Date.now() - Number(forum.latestActivityAt || 0)) / 36e5 <= 72
            ? 'Active recently'
            : 'Trending in the community';

        const relevanceScore = (
          sectionOverlap.length * 240
          + Math.log2((forum.livePostCount ?? forum.postCount ?? 0) + 1) * 72
          + Math.log2((forum.followerCount ?? 0) + 1) * 38
          + Math.max(0, 120 - Math.min((Date.now() - Number(forum.latestActivityAt || 0)) / 36e5, 120))
        );

        return {
          ...forum,
          reason,
          sectionOverlapCount: sectionOverlap.length,
          relevanceScore
        };
      });
  }, [followedForumKeySet, followedSectionSet, forumDirectory]);

  const filteredCreators = useMemo(() => {
    const supportsInterest = (creator) => {
      if (selectedInterest === '__all') {
        return true;
      }
      return [...creator.sectionSet].includes(selectedInterest);
    };

    const candidates = creatorCandidates.filter((creator) => {
      if (!supportsInterest(creator)) {
        return false;
      }

      return matchByQuery(
        searchQuery,
        creator.name,
        creator.bio,
        creator.reason,
        [...creator.sectionSet].map((section) => getSectionLabel(section)).join(' ')
      );
    });

    return [...candidates]
      .sort((left, right) => {
        if (sortMode === 'active') {
          return right.lastActiveAt - left.lastActiveAt || right.postCount - left.postCount;
        }
        if (sortMode === 'popular') {
          return right.totalViews - left.totalViews || right.postCount - left.postCount;
        }
        if (sortMode === 'newest') {
          return right.lastActiveAt - left.lastActiveAt;
        }
        return right.relevanceScore - left.relevanceScore || right.lastActiveAt - left.lastActiveAt;
      })
      .slice(0, 12);
  }, [creatorCandidates, searchQuery, selectedInterest, sortMode]);

  const filteredSpaces = useMemo(() => {
    const candidates = spaceCandidates.filter((forum) => {
      const supportsInterest = selectedInterest === '__all' || (forum.sectionScope || []).includes(selectedInterest);
      if (!supportsInterest) {
        return false;
      }

      return matchByQuery(
        searchQuery,
        forum.name,
        forum.description,
        forum.reason,
        (forum.sectionScope || []).map((section) => getSectionLabel(section)).join(' ')
      );
    });

    return [...candidates]
      .sort((left, right) => {
        if (sortMode === 'active') {
          return sortByRecentActivity(left, right);
        }
        if (sortMode === 'popular') {
          return Number(right.followerCount || 0) - Number(left.followerCount || 0)
            || Number(right.livePostCount || right.postCount || 0) - Number(left.livePostCount || left.postCount || 0);
        }
        if (sortMode === 'newest') {
          return Number(right.latestActivityAt || 0) - Number(left.latestActivityAt || 0);
        }
        return right.relevanceScore - left.relevanceScore
          || Number(right.latestActivityAt || 0) - Number(left.latestActivityAt || 0);
      })
      .slice(0, 12);
  }, [searchQuery, selectedInterest, sortMode, spaceCandidates]);

  const activeNowSpaces = useMemo(() => {
    return [...spaceCandidates]
      .sort(sortByRecentActivity)
      .slice(0, 5);
  }, [spaceCandidates]);

  const followCreator = useCallback(async (creator) => {
    const token = authStorage.getToken();
    if (!token) {
      setFeedback({ type: 'error', text: 'Please log in to follow creators.' });
      return;
    }

    setPendingCreatorId(creator.id);
    try {
      await apiFollowUser(creator.id, token);
      setFollowedUserIds((current) => {
        const next = new Set(current);
        next.add(creator.id);
        return next;
      });
      setFeedback({ type: 'success', text: `Now following ${creator.name}.` });
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Failed to follow creator.' });
    } finally {
      setPendingCreatorId('');
    }
  }, []);

  const joinSpace = useCallback(async (forum) => {
    const token = authStorage.getToken();
    const forumKey = getForumKey(forum);
    if (!token) {
      setFeedback({ type: 'error', text: 'Please log in to join spaces.' });
      return;
    }
    if (!forum?.id) {
      setFeedback({ type: 'error', text: 'This space is currently unavailable.' });
      return;
    }

    setPendingForumKey(forumKey);
    try {
      await apiFollowForum(forum.id, token);
      setLocalFollowedForumKeys((current) => {
        const next = new Set(current);
        if (forumKey) {
          next.add(forumKey);
        }
        return next;
      });
      setFeedback({ type: 'success', text: `Added ${forum.name} to your spaces.` });
      if (typeof onLoadForums === 'function') {
        await onLoadForums();
      }
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Failed to join space.' });
    } finally {
      setPendingForumKey('');
    }
  }, [onLoadForums]);

  return (
    <div className="container page-shell">
      <div className="discover-page-shell">
        <section className="discover-header">
          <div>
            <p className="type-kicker mb-1">Discover</p>
            <h1 className="discover-title mb-1">Discover</h1>
            <p className="discover-subtitle mb-0">Find creators and spaces you may like.</p>
          </div>
          <Link to="/forum" className="forum-secondary-btn text-decoration-none discover-back-btn">
            Back to Feed
          </Link>
        </section>

        <section className="community-feed-control-bar discover-controls-row" aria-label="Discover filters">
          <label className="community-feed-control community-feed-control-search">
            <span className="community-feed-control-label">Refine results</span>
            <div className="community-feed-search">
              <input
                className="form-control forum-input tag-search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Refine results"
                aria-label="Refine discover results"
              />
              {search && (
                <button
                  type="button"
                  className="community-feed-search-clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear refine filter"
                >
                  Clear
                </button>
              )}
            </div>
          </label>

          <label className="community-feed-control">
            <span className="community-feed-control-label">
              {DISCOVER_SORT_OPTIONS.find((option) => option.value === sortMode)?.label || 'Relevance'}
            </span>
            <div className="forum-native-select-wrap">
              <select
                className="forum-native-select"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value)}
              >
                {DISCOVER_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </label>

          <label className="community-feed-control">
            <span className="community-feed-control-label">
              {selectedInterest === '__all'
                ? 'All interests'
                : getSectionLabel(selectedInterest)}
            </span>
            <div className="forum-native-select-wrap">
              <select
                className="forum-native-select"
                value={selectedInterest}
                onChange={(event) => setSelectedInterest(event.target.value)}
              >
                <option value="__all">All interests</option>
                {interestOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </label>
        </section>

        {feedback.text ? (
          <div className={`settings-alert ${feedback.type === 'error' ? 'is-error' : 'is-success'} mb-0`}>
            {feedback.text}
          </div>
        ) : null}

        <section className="discover-content-section">
          <div className="discover-section-head">
            <div>
              <h2 className="discover-section-title mb-1">Suggested Creators</h2>
              <p className="discover-section-copy mb-0">People you are not following yet, prioritized for relevance.</p>
            </div>
            <span className="discover-section-count">{filteredCreators.length}</span>
          </div>

          {networkLoading ? (
            <p className="muted mb-0">Loading personalized creator recommendations...</p>
          ) : filteredCreators.length > 0 ? (
            <div className="discover-creator-grid">
              {filteredCreators.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  currentUser={currentUser}
                  pending={pendingCreatorId === creator.id}
                  onFollow={followCreator}
                />
              ))}
            </div>
          ) : (
            <div className="discover-empty-state">
              <h3 className="mb-1">No new creators found</h3>
              <p className="mb-0">Try a different interest or search term to widen recommendations.</p>
            </div>
          )}
        </section>

        <section className="discover-content-section">
          <div className="discover-section-head">
            <div>
              <h2 className="discover-section-title mb-1">Suggested Spaces</h2>
              <p className="discover-section-copy mb-0">Communities you are not following yet, tuned for exploration.</p>
            </div>
            <span className="discover-section-count">{filteredSpaces.length}</span>
          </div>

          {filteredSpaces.length > 0 ? (
            <div className="discover-space-grid">
              {filteredSpaces.map((forum) => (
                <SpaceCard
                  key={forum.id || forum.slug}
                  forum={forum}
                  currentUser={currentUser}
                  pending={pendingForumKey === getForumKey(forum)}
                  onJoin={joinSpace}
                />
              ))}
            </div>
          ) : (
            <div className="discover-empty-state">
              <h3 className="mb-1">No new spaces found</h3>
              <p className="mb-0">You may already follow most matches. Try another filter for broader suggestions.</p>
            </div>
          )}
        </section>

        {activeNowSpaces.length > 0 ? (
          <section className="discover-active-strip">
            <div className="discover-active-head">
              <h3 className="mb-0">Active Now</h3>
              <span className="muted">Quick jump</span>
            </div>
            <div className="discover-active-list">
              {activeNowSpaces.map((forum) => (
                <Link key={`active-${forum.id || forum.slug}`} to={`/forum/${forum.slug}`} className="discover-active-pill">
                  <strong>{forum.name}</strong>
                  <span>{formatCount(forum.livePostCount ?? forum.postCount ?? 0)} posts</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
