import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  apiFollowUser,
  apiGetUserProfile,
  apiUnfollowUser,
  resolveMediaSource
} from '../api';
import Avatar from '../components/Avatar';
import FeedCard from '../components/feed/FeedCard';
import { authStorage } from '../lib/authStorage';
import { getSectionLabel } from '../lib/sections';

const PROFILE_TAB_KEYS = [
  { key: 'posts', label: 'Posts' },
  { key: 'spaces', label: 'Spaces' },
  { key: 'about', label: 'About' },
  { key: 'activity', label: 'Activity' }
];

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

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

function formatJoinedDate(timestamp) {
  const value = Number(timestamp || 0);
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric'
  });
}

function formatActivityTime(timestamp) {
  const value = Number(timestamp || 0);
  if (!value) {
    return 'Recently';
  }
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function deriveProfileHandle(profile) {
  const explicit = String(profile?.username || '').trim();
  if (explicit) {
    return explicit.startsWith('@') ? explicit : `@${explicit}`;
  }

  const fromName = String(profile?.name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);

  if (fromName) {
    return `@${fromName}`;
  }

  const fromId = String(profile?.id || '').trim().slice(0, 8);
  return fromId ? `@${fromId}` : '@user';
}

function getPostCoverImage(content) {
  const markdownMatch = String(content || '').match(/!\[[^\]]*]\((\S+?)(?:\s+["'][^"']*["'])?\)/i);
  if (markdownMatch?.[1]) {
    return resolveMediaSource(markdownMatch[1].replace(/^<|>$/g, '').trim());
  }

  const htmlMatch = String(content || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlMatch?.[1]) {
    return resolveMediaSource(htmlMatch[1].trim());
  }

  return '';
}

function getTextPreview(content, maxLength = 150) {
  const text = String(content || '')
    .replace(/!\[[^\]]*]\((.*?)\)/g, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#>*_[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function sortByTimestamp(items, getTimestamp) {
  return [...items].sort((left, right) => Number(getTimestamp(right) || 0) - Number(getTimestamp(left) || 0));
}

function mergeRole(currentRole, nextRole) {
  const rank = { Owner: 4, 'Space Admin': 3, Member: 2, Contributor: 1 };
  return (rank[nextRole] || 0) > (rank[currentRole] || 0) ? nextRole : currentRole;
}

function resolveActiveTab(searchParams) {
  const tab = normalizeText(searchParams.get('tab'));
  return PROFILE_TAB_KEYS.some((item) => item.key === tab) ? tab : 'posts';
}

export default function UserProfile({ currentUser, forums = [] }) {
  const { userId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [togglePending, setTogglePending] = useState(false);

  const activeTab = resolveActiveTab(searchParams);

  useEffect(() => {
    let cancelled = false;
    const token = authStorage.getToken();

    async function loadProfile() {
      setLoading(true);
      setMessage('');
      try {
        const data = await apiGetUserProfile(userId, token);
        if (!cancelled) {
          setProfile(data.user || null);
          setPosts(data.posts || []);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Failed to load profile.');
          setProfile(null);
          setPosts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser?.id]);

  const postCards = useMemo(() => (
    posts.map((post) => ({
      ...post,
      authorAvatarUrl: resolveMediaSource(post.authorAvatarUrl),
      coverImage: getPostCoverImage(post.content),
      textPreview: getTextPreview(post.content)
    }))
  ), [posts]);

  const profileSpaces = useMemo(() => {
    const map = new Map();

    posts.forEach((post) => {
      const forum = post.forum;
      if (!forum || (!forum.id && !forum.slug)) {
        return;
      }
      const key = String(forum.id || forum.slug);
      const existing = map.get(key) || {
        id: forum.id || key,
        slug: forum.slug || '',
        name: forum.name || 'General',
        description: forum.description || '',
        role: 'Contributor',
        postCount: 0,
        followerCount: Number(forum.followerCount || 0),
        sectionScope: forum.sectionScope || [],
        lastActivityAt: 0
      };

      existing.postCount += 1;
      existing.lastActivityAt = Math.max(existing.lastActivityAt, Number(post.updatedAt || post.createdAt || 0));
      existing.followerCount = Math.max(existing.followerCount, Number(forum.followerCount || 0));
      if (!existing.description && forum.description) {
        existing.description = forum.description;
      }
      if ((!existing.slug || existing.slug === key) && forum.slug) {
        existing.slug = forum.slug;
      }
      if ((!existing.name || existing.name === 'General') && forum.name) {
        existing.name = forum.name;
      }
      if ((existing.sectionScope || []).length === 0 && (forum.sectionScope || []).length > 0) {
        existing.sectionScope = forum.sectionScope || [];
      }
      map.set(key, existing);
    });

    if (profile?.isSelf) {
      forums.forEach((forum) => {
        if (!forum?.id) {
          return;
        }
        if (!(forum.ownerId === currentUser?.id || forum.canManage || forum.isFollowing)) {
          return;
        }
        const key = String(forum.id);
        const role = forum.ownerId === currentUser?.id
          ? 'Owner'
          : forum.canManage
            ? 'Space Admin'
            : forum.isFollowing
              ? 'Member'
              : 'Contributor';
        const existing = map.get(key) || {
          id: forum.id,
          slug: forum.slug || '',
          name: forum.name || 'Space',
          description: forum.description || '',
          role,
          postCount: 0,
          followerCount: Number(forum.followerCount || 0),
          sectionScope: forum.sectionScope || [],
          lastActivityAt: Number(forum.updatedAt || 0)
        };

        existing.role = mergeRole(existing.role, role);
        existing.followerCount = Math.max(existing.followerCount, Number(forum.followerCount || 0));
        if (!existing.description && forum.description) {
          existing.description = forum.description;
        }
        if (!existing.slug && forum.slug) {
          existing.slug = forum.slug;
        }
        if (!existing.name && forum.name) {
          existing.name = forum.name;
        }
        if ((existing.sectionScope || []).length === 0 && (forum.sectionScope || []).length > 0) {
          existing.sectionScope = forum.sectionScope || [];
        }
        map.set(key, existing);
      });
    }

    return sortByTimestamp(
      [...map.values()],
      (item) => item.lastActivityAt || item.postCount || 0
    );
  }, [currentUser?.id, forums, posts, profile?.isSelf]);

  const postSectionCounts = useMemo(() => {
    const map = new Map();
    posts.forEach((post) => {
      const sectionValue = String(post.section || '').trim();
      if (!sectionValue) {
        return;
      }
      map.set(sectionValue, (map.get(sectionValue) || 0) + 1);
    });
    return [...map.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [posts]);

  const activityItems = useMemo(() => {
    return sortByTimestamp(posts, (item) => item.updatedAt || item.createdAt)
      .slice(0, 12)
      .map((post) => ({
        id: post.id,
        title: post.title,
        forumName: post.forum?.name || 'General',
        forumSlug: post.forum?.slug || '',
        section: getSectionLabel(post.section),
        timestamp: Number(post.updatedAt || post.createdAt || 0),
        actionLabel: post.updatedAt ? 'Updated a post' : 'Published a post'
      }));
  }, [posts]);

  const profileSummary = useMemo(() => {
    return {
      joined: formatJoinedDate(profile?.createdAt),
      followerCount: Number(profile?.followerCount || 0),
      followingCount: Number(profile?.followingCount || 0),
      postCount: postCards.length,
      spaceCount: profileSpaces.length
    };
  }, [postCards.length, profile?.createdAt, profile?.followerCount, profile?.followingCount, profileSpaces.length]);

  const switchTab = (tab) => {
    if (!PROFILE_TAB_KEYS.some((item) => item.key === tab)) {
      return;
    }
    setSearchParams(tab === 'posts' ? {} : { tab });
  };

  const toggleFollow = async () => {
    const token = authStorage.getToken();
    if (!token) {
      setMessage('Please login first.');
      return;
    }

    setTogglePending(true);
    try {
      if (profile?.isFollowing) {
        await apiUnfollowUser(userId, token);
        setProfile((prev) => ({
          ...prev,
          isFollowing: false,
          followerCount: Math.max(0, Number(prev?.followerCount || 0) - 1)
        }));
      } else {
        await apiFollowUser(userId, token);
        setProfile((prev) => ({
          ...prev,
          isFollowing: true,
          followerCount: Number(prev?.followerCount || 0) + 1
        }));
      }
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update follow state.');
    } finally {
      setTogglePending(false);
    }
  };

  if (loading) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <p className="muted mb-0">Loading profile...</p>
        </section>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <h2 className="mb-2">User not found</h2>
          <p className="muted mb-3">{message || 'This user profile is unavailable.'}</p>
          <Link to="/forum" className="forum-primary-btn text-decoration-none">Back to Feed</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <section className="profile-page-shell">
        <header className="profile-header">
          <div className="profile-identity">
            <Avatar
              imageUrl={resolveMediaSource(profile.avatarUrl)}
              name={profile.name}
              size={84}
              className="profile-avatar"
            />
            <div className="profile-identity-copy">
              <p className="type-kicker mb-1">{profile.isSelf ? 'My Public Presence' : 'Creator Profile'}</p>
              <h1 className="profile-name mb-1">{profile.name}</h1>
              <p className="profile-handle mb-1">{deriveProfileHandle(profile)}</p>
              <p className="profile-bio mb-0">
                {profile.bio || 'Sharing practical ideas, community participation, and content that helps others learn.'}
              </p>
            </div>
          </div>

          <div className="profile-header-actions">
            {profile.isSelf ? (
              <>
                <Link to="/settings?panel=profile" className="forum-primary-btn text-decoration-none">
                  Edit Profile
                </Link>
                <Link to="/my-posts" className="forum-secondary-btn text-decoration-none">
                  My Posts
                </Link>
                <Link to="/saved" className="forum-secondary-btn text-decoration-none">
                  Saved
                </Link>
                <Link to="/my-spaces" className="forum-secondary-btn text-decoration-none">
                  My Spaces
                </Link>
              </>
            ) : currentUser ? (
              <button
                type="button"
                className={profile.isFollowing ? 'forum-secondary-btn' : 'forum-primary-btn'}
                onClick={toggleFollow}
                disabled={togglePending}
              >
                {togglePending ? 'Updating...' : profile.isFollowing ? 'Unfollow' : 'Follow'}
              </button>
            ) : (
              <Link to="/login" className="forum-secondary-btn text-decoration-none">
                Login to Follow
              </Link>
            )}
          </div>
        </header>

        <div className="profile-summary-row">
          <span className="profile-summary-chip">{formatCount(profileSummary.followerCount)} followers</span>
          <span className="profile-summary-chip">{formatCount(profileSummary.followingCount)} following</span>
          <span className="profile-summary-chip">{formatCount(profileSummary.postCount)} posts</span>
          <span className="profile-summary-chip">{formatCount(profileSummary.spaceCount)} spaces</span>
          {profileSummary.joined ? <span className="profile-summary-chip">Joined {profileSummary.joined}</span> : null}
        </div>

        {message ? (
          <div className="settings-alert is-error mb-0">{message}</div>
        ) : null}

        <nav className="profile-tabs" aria-label="Profile content tabs">
          {PROFILE_TAB_KEYS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`profile-tab-btn ${activeTab === tab.key ? 'is-active' : ''}`.trim()}
              onClick={() => switchTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'posts' ? (
          <section className="profile-content-section">
            <div className="profile-section-head">
              <h2 className="profile-section-title mb-0">{profile.isSelf ? 'My Posts' : `${profile.name}'s Posts`}</h2>
              <span className="profile-section-count">{postCards.length}</span>
            </div>

            {postCards.length > 0 ? (
              <div className="forum-feed discovery-feed-grid profile-post-grid">
                {postCards.map((post) => (
                  <FeedCard
                    key={post.id}
                    post={post}
                    coverImage={post.coverImage}
                    textPreview={post.textPreview}
                    isAggregateView={false}
                    canManage={false}
                    onModerate={() => {}}
                  />
                ))}
              </div>
            ) : (
              <section className="profile-empty-state">
                <h3 className="my-posts-empty-title mb-0">No posts yet</h3>
                <p className="my-posts-empty-copy mb-0">
                  {profile.isSelf
                    ? 'Publish your first post to start building your public profile.'
                    : 'This creator has not published any posts yet.'}
                </p>
              </section>
            )}
          </section>
        ) : null}

        {activeTab === 'spaces' ? (
          <section className="profile-content-section">
            <div className="profile-section-head">
              <h2 className="profile-section-title mb-0">Spaces</h2>
              <span className="profile-section-count">{profileSpaces.length}</span>
            </div>

            {profileSpaces.length > 0 ? (
              <div className="profile-space-grid">
                {profileSpaces.map((space) => {
                  const sectionPreview = (space.sectionScope || [])
                    .map((section) => getSectionLabel(section))
                    .slice(0, 3)
                    .join(' | ');

                  return (
                    <article key={`space-${space.id}`} className="profile-space-card">
                      <div className="profile-space-card-head">
                        <span className="profile-space-avatar" aria-hidden="true">
                          {String(space.name || '').trim().charAt(0).toUpperCase() || 'S'}
                        </span>
                        <div className="profile-space-card-copy">
                          <strong title={space.name}>{space.name}</strong>
                          <span>{space.role}</span>
                        </div>
                      </div>

                      <p className="profile-space-card-description mb-0">
                        {space.description || 'Community space with ongoing discussion and creator activity.'}
                      </p>

                      <div className="profile-space-card-meta">
                        <span>{formatCount(space.followerCount)} followers</span>
                        <span>{formatCount(space.postCount)} posts</span>
                        <span>{formatActivityTime(space.lastActivityAt)}</span>
                      </div>

                      {sectionPreview ? (
                        <p className="profile-space-card-sections mb-0" title={sectionPreview}>
                          {sectionPreview}
                        </p>
                      ) : null}

                      <div className="profile-space-card-actions">
                        {space.slug ? (
                          <Link to={`/forum/${space.slug}`} className="following-link-btn">View Space</Link>
                        ) : (
                          <span className="muted">Space unavailable</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <section className="profile-empty-state">
                <h3 className="my-posts-empty-title mb-0">No spaces to show</h3>
                <p className="my-posts-empty-copy mb-0">
                  {profile.isSelf
                    ? 'Create, follow, or post in spaces to see them here.'
                    : 'This creator has no visible space activity yet.'}
                </p>
              </section>
            )}
          </section>
        ) : null}

        {activeTab === 'about' ? (
          <section className="profile-content-section">
            <div className="profile-section-head">
              <h2 className="profile-section-title mb-0">About</h2>
            </div>

            <div className="profile-about-grid">
              <article className="profile-about-card">
                <h3 className="profile-about-title mb-1">Bio</h3>
                <p className="profile-about-copy mb-0">
                  {profile.bio || 'No bio yet. This section can be expanded as profile details grow.'}
                </p>
              </article>

              <article className="profile-about-card">
                <h3 className="profile-about-title mb-1">Creator Focus</h3>
                {postSectionCounts.length > 0 ? (
                  <div className="profile-focus-chips">
                    {postSectionCounts.map(([section, count]) => (
                      <span key={`focus-${section}`} className="profile-focus-chip">
                        {getSectionLabel(section)} · {count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="profile-about-copy mb-0">No topic signals yet.</p>
                )}
              </article>

              <article className="profile-about-card">
                <h3 className="profile-about-title mb-1">Profile Snapshot</h3>
                <div className="profile-about-stats">
                  <span>{formatCount(profileSummary.followerCount)} followers</span>
                  <span>{formatCount(profileSummary.followingCount)} following</span>
                  <span>{formatCount(profileSummary.postCount)} posts</span>
                  <span>{formatCount(profileSummary.spaceCount)} spaces</span>
                  {profileSummary.joined ? <span>Joined {profileSummary.joined}</span> : null}
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {activeTab === 'activity' ? (
          <section className="profile-content-section">
            <div className="profile-section-head">
              <h2 className="profile-section-title mb-0">Activity</h2>
              <span className="profile-section-count">{activityItems.length}</span>
            </div>

            {activityItems.length > 0 ? (
              <div className="profile-activity-list">
                {activityItems.map((item) => (
                  <article key={`activity-${item.id}`} className="profile-activity-item">
                    <div className="profile-activity-dot" aria-hidden="true" />
                    <div className="profile-activity-copy">
                      <p className="profile-activity-main mb-0">
                        <span>{item.actionLabel}</span>
                        <Link to={`/forum/post/${item.id}`}>{item.title}</Link>
                      </p>
                      <p className="profile-activity-meta mb-0">
                        <span>{item.forumSlug ? <Link to={`/forum/${item.forumSlug}`}>{item.forumName}</Link> : item.forumName}</span>
                        <span>{item.section}</span>
                        <span>{formatActivityTime(item.timestamp)}</span>
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <section className="profile-empty-state">
                <h3 className="my-posts-empty-title mb-0">No recent activity yet</h3>
                <p className="my-posts-empty-copy mb-0">
                  Activity will appear here as posts and participation grow.
                </p>
              </section>
            )}
          </section>
        ) : null}
      </section>
    </div>
  );
}
