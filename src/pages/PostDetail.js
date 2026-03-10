import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getSectionLabel(value) {
  return String(value || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function PostDetail({ posts, currentUser, onAdminRemovePost }) {
  const { postId } = useParams();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const post = useMemo(
    () => posts.find((item) => item.id === postId) || null,
    [posts, postId]
  );

  const removePost = async () => {
    setError('');
    setMessage('');
    const result = await onAdminRemovePost(postId, reason);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message);
  };

  if (!post) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <h2 className="mb-2">Post not found</h2>
          <p className="muted mb-3">This post may have been removed or is no longer available.</p>
          <Link to="/forum" className="forum-primary-btn text-decoration-none">
            Back to Forum
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <section className="panel post-detail-shell">
        <div className="post-detail-topbar">
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">
            Back to Forum
          </Link>
          <span className="muted">{formatTime(post.createdAt)}</span>
        </div>

        <div className="post-detail-meta">
          <span className="forum-tag">{getSectionLabel(post.section)}</span>
          <span className="muted">
            Posted by{' '}
            <Link to={`/users/${post.authorId}`} className="post-author-link">
              {post.authorName}
            </Link>
          </span>
        </div>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-3`}>
            {error || message}
          </div>
        )}

        <h1 className="post-detail-title">{post.title}</h1>

        {!!post.tags?.length && (
          <div className="post-tag-row mb-3">
            {post.tags.map((tag) => (
              <span key={`${post.id}-${tag}`} className="post-tag-pill">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="post-detail-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={{
              code({ inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                if (inline) {
                  return (
                    <code className="post-inline-code" {...props}>
                      {children}
                    </code>
                  );
                }

                return (
                  <section className="post-code-block">
                    {match?.[1] && <div className="post-code-label">{match[1]}</div>}
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match?.[1] || 'text'}
                      PreTag="div"
                      className="post-code-pre"
                      customStyle={{ margin: 0, background: 'transparent', padding: '1rem' }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </section>
                );
              },
              p({ children }) {
                return <p>{children}</p>;
              }
            }}
          >
            {post.content || ''}
          </ReactMarkdown>
        </div>

        {currentUser?.isAdmin && (
          <section className="settings-card settings-danger-card mt-4">
            <h4 className="mb-2">Admin Moderation</h4>
            <p className="muted mb-3">Remove this post from public view. The author will have 15 days to request restoration.</p>
            <div className="mb-3">
              <label className="form-label">Moderation reason</label>
              <textarea
                className="form-control forum-input"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why the post violates policy."
              />
            </div>
            <button type="button" className="forum-danger-btn" onClick={removePost}>
              Remove Post
            </button>
          </section>
        )}
      </section>
    </div>
  );
}
