import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  apiFollowUser,
  apiGetUserProfile,
  resolveMediaSource,
  apiUnfollowUser
} from '../api';
import { authStorage } from '../lib/authStorage';

function getSectionLabel(value) {
  return String(value || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

function getTextCardPreview(content) {
  const text = String(content || '')
    .replace(/!\[[^\]]*]\((.*?)\)/g, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#>*_[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= 150) {
    return text;
  }

  return `${text.slice(0, 150).trimEnd()}...`;
}

function getUserAvatarInitial(name) {
  const cleanName = String(name || '').trim();
  return cleanName ? cleanName.slice(0, 1).toUpperCase() : 'T';
}

export default function UserProfile({ currentUser }) {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = authStorage.getToken();

    async function loadProfile() {
      setLoading(true);
      setMessage('');
      try {
        const data = await apiGetUserProfile(userId, token);
        if (!cancelled) {
          setProfile(data.user);
          setPosts(data.posts || []);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error.message);
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

  const joinedLabel = useMemo(() => {
    if (!profile?.createdAt) return '';
    return new Date(profile.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric'
    });
  }, [profile]);
  const postCards = useMemo(() => (
    posts.map((post) => ({
      ...post,
      coverImage: getPostCoverImage(post.content),
      textPreview: getTextCardPreview(post.content)
    }))
  ), [posts]);

  const toggleFollow = async () => {
    const token = authStorage.getToken();
    if (!token) {
      setMessage('Please login first.');
      return;
    }
    try {
      if (profile.isFollowing) {
        await apiUnfollowUser(userId, token);
        setProfile((prev) => ({
          ...prev,
          isFollowing: false,
          followerCount: Math.max(0, (prev?.followerCount || 0) - 1)
        }));
      } else {
        await apiFollowUser(userId, token);
        setProfile((prev) => ({
          ...prev,
          isFollowing: true,
          followerCount: (prev?.followerCount || 0) + 1
        }));
      }
      setMessage('');
    } catch (error) {
      setMessage(error.message);
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
      <section className="panel user-space-hero mb-4">
        <div>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="user-space-avatar" />
          ) : (
            <div className="user-space-avatar-fallback">
              {getUserAvatarInitial(profile.name)}
            </div>
          )}
          <p className="type-kicker mb-2">User Space</p>
          <h1 className="user-space-title type-title-lg mb-2">{profile.name}</h1>
          <p className="type-body mb-0">
            {profile.bio || 'Sharing technical work, implementation details, and practical lessons.'}
          </p>
        </div>
        <div className="user-space-actions">
          <div className="user-space-stats">
            {profile.isSelf ? (
              <Link to="/following?tab=followers" className="user-space-stat-link">
                {profile.followerCount} followers
              </Link>
            ) : (
              <span>{profile.followerCount} followers</span>
            )}
            {profile.isSelf ? (
              <Link to="/following?tab=following" className="user-space-stat-link">
                {profile.followingCount} following
              </Link>
            ) : (
              <span>{profile.followingCount} following</span>
            )}
            {joinedLabel && <span>Joined {joinedLabel}</span>}
          </div>
          {!profile.isSelf && currentUser && (
            <button type="button" className="forum-primary-btn" onClick={toggleFollow}>
              {profile.isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
          {profile.isSelf && (
            <Link to="/my-posts" className="forum-secondary-btn text-decoration-none">
              Manage My Posts
            </Link>
          )}
          {!currentUser && !profile.isSelf && (
            <Link to="/login" className="forum-secondary-btn text-decoration-none">
              Login to Follow
            </Link>
          )}
        </div>
      </section>

      {message && <div className="settings-alert is-error mb-4">{message}</div>}

      <section className="panel user-space-posts-panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h3 className="mb-1 type-title-md">{profile.isSelf ? 'Your Published Posts' : `${profile.name}'s Posts`}</h3>
            <p className="type-body mb-0">{posts.length} published posts</p>
          </div>
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">Back to Feed</Link>
        </div>

        <div className={`forum-feed user-space-posts-feed ${postCards.length > 0 && postCards.length <= 3 ? 'is-sparse' : ''}`.trim()}>
          {postCards.map((post) => (
            <article key={post.id} className="forum-post-card">
              <Link to={`/forum/post/${post.id}`} className="forum-post-cover-link">
                <div className={`forum-post-cover ${post.coverImage ? 'has-image' : 'is-title-only'}`.trim()}>
                  {post.coverImage ? (
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="forum-post-cover-image"
                      loading="lazy"
                    />
                  ) : (
                    <div className="forum-post-cover-fallback">
                      <div className="forum-post-cover-fallback-copy">
                        <span className="forum-post-cover-fallback-title">{post.title}</span>
                      </div>
                    </div>
                  )}
                  <div className="forum-post-cover-badges">
                    {post.forum?.name && post.forum?.slug ? (
                      <span className="forum-origin-chip">
                        <span className="forum-origin-chip-label">Space</span>
                        <span>{post.forum.name}</span>
                      </span>
                    ) : (
                      <span className="forum-origin-chip is-static">
                        <span className="forum-origin-chip-label">Space</span>
                        <span>{post.forum?.name || 'General'}</span>
                      </span>
                    )}
                    <span className="forum-tag">{getSectionLabel(post.section)}</span>
                  </div>
                </div>
              </Link>

              <div className="forum-post-card-body">
                {post.coverImage && (
                  <h5 className="mb-0 forum-post-card-title">
                    <Link to={`/forum/post/${post.id}`} className="post-title-link">
                      {post.title}
                    </Link>
                  </h5>
                )}

                {!post.coverImage && (
                  <p className="mb-0 forum-post-card-summary">
                    <Link to={`/forum/post/${post.id}`} className="forum-post-summary-link">
                      {post.textPreview || post.title}
                    </Link>
                  </p>
                )}

                <div className="forum-post-card-meta">
                  <Link to={`/users/${post.authorId}`} className="forum-post-author-link">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={profile.name}
                        className="forum-post-author-avatar-image"
                      />
                    ) : (
                      <span className="forum-post-author-avatar" aria-hidden="true">{getUserAvatarInitial(profile.name)}</span>
                    )}
                    <span className="forum-post-author-name">{post.authorName}</span>
                  </Link>
                  <span className="forum-post-card-views">
                    {typeof post.viewCount === 'number' ? `${post.viewCount} views` : formatTime(post.createdAt)}
                  </span>
                </div>
              </div>
            </article>
          ))}

          {postCards.length === 0 && (
            <section className="settings-card">
              <h4 className="mb-2">No posts yet</h4>
              <p className="muted mb-0">This user has not published anything yet.</p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
