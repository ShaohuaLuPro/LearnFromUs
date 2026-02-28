import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  TOKEN_KEY,
  apiFollowUser,
  apiGetUserProfile,
  apiUnfollowUser
} from '../api';

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

function getPreview(content) {
  const text = String(content || '').trim();
  if (text.length <= 180) {
    return text;
  }
  return `${text.slice(0, 180).trimEnd()}...`;
}

export default function UserProfile({ currentUser }) {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem(TOKEN_KEY);

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

  const toggleFollow = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
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
          <Link to="/forum" className="forum-primary-btn text-decoration-none">Back to Forum</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <section className="panel user-space-hero mb-4">
        <div>
          <p className="type-kicker mb-2">User Space</p>
          <h1 className="user-space-title type-title-lg mb-2">{profile.name}</h1>
          <p className="type-body mb-0">
            {profile.bio || 'Sharing technical work, implementation details, and practical lessons.'}
          </p>
        </div>
        <div className="user-space-actions">
          <div className="user-space-stats">
            <span>{profile.followerCount} followers</span>
            <span>{profile.followingCount} following</span>
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

      <section className="panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h3 className="mb-1 type-title-md">{profile.isSelf ? 'Your Published Posts' : `${profile.name}'s Posts`}</h3>
            <p className="type-body mb-0">{posts.length} published posts</p>
          </div>
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">Back to Forum</Link>
        </div>

        <div className="forum-feed">
          {posts.map((post) => (
            <article key={post.id} className="forum-post-card">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="forum-tag">{getSectionLabel(post.section)}</span>
                <span className="muted forum-time">{formatTime(post.createdAt)}</span>
              </div>
              <h5 className="mb-1">
                <Link to={`/forum/post/${post.id}`} className="post-title-link">
                  {post.title}
                </Link>
              </h5>
              {!!post.tags?.length && (
                <div className="post-tag-row mb-2">
                  {post.tags.map((tag) => (
                    <span key={`${post.id}-${tag}`} className="post-tag-pill">#{tag}</span>
                  ))}
                </div>
              )}
              <p className="mb-2 forum-post-preview">{getPreview(post.content)}</p>
              <div className="d-flex justify-content-end">
                <Link to={`/forum/post/${post.id}`} className="post-read-link">
                  Read more
                </Link>
              </div>
            </article>
          ))}

          {posts.length === 0 && (
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
