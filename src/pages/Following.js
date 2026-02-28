import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TOKEN_KEY, apiGetFollowing } from '../api';

function getSectionLabel(value) {
  return String(value || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getPreview(content) {
  const text = String(content || '').trim();
  if (text.length <= 160) {
    return text;
  }
  return `${text.slice(0, 160).trimEnd()}...`;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function Following() {
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowing() {
      setLoading(true);
      setMessage('');
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const data = await apiGetFollowing(token);
        if (!cancelled) {
          setUsers(data.users || []);
          setPosts(data.posts || []);
        }
      } catch (error) {
        if (!cancelled) {
          setUsers([]);
          setPosts([]);
          setMessage(error.message);
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
  }, []);

  if (loading) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <p className="muted mb-0">Loading following feed...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <section className="panel mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-2">Network</p>
            <h2 className="mb-1 type-title-md">Following</h2>
            <p className="type-body mb-0">Jump into the profiles you follow and track what they publish.</p>
          </div>
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">
            Back to Forum
          </Link>
        </div>

        {message && <div className="settings-alert is-error mb-3">{message}</div>}

        <div className="following-user-grid">
          {users.map((user) => (
            <Link key={user.id} to={`/users/${user.id}`} className="following-user-card">
              <div>
                <h5 className="mb-1">{user.name}</h5>
                <p className="muted mb-2">{user.bio || 'Technical builder sharing practical work.'}</p>
              </div>
              <div className="following-user-stats">
                <span>{user.followerCount} followers</span>
                <span>{user.followingCount} following</span>
              </div>
            </Link>
          ))}
        </div>

        {users.length === 0 && !message && (
          <section className="settings-card mt-3">
            <h4 className="mb-2">You are not following anyone yet</h4>
            <p className="muted mb-0">Visit a user profile and click follow to build your network.</p>
          </section>
        )}
      </section>

      <section className="panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h3 className="mb-1 type-title-md">Recent Posts From People You Follow</h3>
            <p className="type-body mb-0">{posts.length} recent posts</p>
          </div>
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
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <small className="muted">
                  Posted by{' '}
                  <Link to={`/users/${post.authorId}`} className="post-author-link">
                    {post.authorName}
                  </Link>
                </small>
                <Link to={`/forum/post/${post.id}`} className="post-read-link">
                  Read more
                </Link>
              </div>
            </article>
          ))}
        </div>

        {posts.length === 0 && users.length > 0 && !message && (
          <section className="settings-card mt-3">
            <h4 className="mb-2">No recent posts yet</h4>
            <p className="muted mb-0">The people you follow have not published anything recently.</p>
          </section>
        )}
      </section>
    </div>
  );
}
