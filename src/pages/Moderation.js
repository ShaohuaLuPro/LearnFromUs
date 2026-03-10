import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function Moderation({ onGetModerationPosts, onRestorePost }) {
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadPosts = async () => {
    const result = await onGetModerationPosts();
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPosts(result.posts || []);
  };

  useEffect(() => {
    async function bootstrap() {
      const result = await onGetModerationPosts();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPosts(result.posts || []);
    }
    bootstrap();
  }, [onGetModerationPosts]);

  const restore = async (postId) => {
    setError('');
    setMessage('');
    const result = await onRestorePost(postId);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message);
    await loadPosts();
  };

  return (
    <div className="container page-shell">
      <section className="panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-2">Admin</p>
            <h2 className="mb-1 type-title-md">Moderation Queue</h2>
            <p className="type-body mb-0">Restore posts under review or inspect user appeals before the 15-day window ends.</p>
          </div>
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">Back to Forum</Link>
        </div>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-3`}>
            {error || message}
          </div>
        )}

        <div className="forum-feed">
          {posts.map((post) => (
            <article key={post.id} className="forum-post-card moderated-post-card">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                <h5 className="mb-0">{post.title}</h5>
                <span className="muted">{formatTime(post.moderation.deletedAt)}</span>
              </div>
              <p className="muted mb-2">
                Author: {post.authorName} ({post.authorEmail})
              </p>
              <p className="mb-2">{post.content}</p>
              <div className="moderation-banner mb-3">
                <strong>Reason:</strong> {post.moderation.deletedReason || 'No reason provided.'}
                {post.moderation.appealRequestedAt && (
                  <span> Appeal filed on {formatTime(post.moderation.appealRequestedAt)}.</span>
                )}
              </div>
              {post.moderation.appealNote && (
                <p className="muted mb-3">
                  <strong>Appeal note:</strong> {post.moderation.appealNote}
                </p>
              )}
              <div className="forum-actions">
                <button type="button" className="forum-primary-btn" onClick={() => restore(post.id)}>
                  Restore Post
                </button>
              </div>
            </article>
          ))}

          {posts.length === 0 && (
            <section className="settings-card">
              <h4 className="mb-2">No moderated posts</h4>
              <p className="muted mb-0">The moderation queue is currently empty.</p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
