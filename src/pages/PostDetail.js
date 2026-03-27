import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MarkdownBlock from '../components/MarkdownBlock';
import { applySeo, buildCanonical, buildPageTitle, DEFAULT_DESCRIPTION } from '../lib/seo';

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

export default function PostDetail({
  currentUser,
  onAdminRemovePost,
  onOwnerRemovePost,
  onGetPostDetail,
  onGetComments,
  onCreateComment
}) {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [commentMessage, setCommentMessage] = useState('');
  const [commentError, setCommentError] = useState('');
  const canSiteModerate = Boolean(currentUser?.isAdmin || currentUser?.adminPermissions?.includes('moderation'));

  useEffect(() => {
    if (!post) {
      applySeo({
        title: buildPageTitle('Forum Post'),
        description: 'Read technical posts and community discussion on LearnFromUs.',
        robots: 'index,follow',
        canonical: buildCanonical(`/forum/post/${postId}`)
      });
      return;
    }

    const preview = String(post.content || '')
      .replace(/[#>*_`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    applySeo({
      title: buildPageTitle(post.title),
      description: preview ? preview.slice(0, 160) : DEFAULT_DESCRIPTION,
      robots: 'index,follow',
      canonical: buildCanonical(`/forum/post/${post.id}`)
    });
  }, [post, postId]);

  useEffect(() => {
    let cancelled = false;

    async function loadPost() {
      setLoading(true);
      setCommentsLoading(true);
      const [postResult, commentsResult] = await Promise.all([
        onGetPostDetail(postId),
        onGetComments(postId)
      ]);

      if (cancelled) {
        return;
      }

      if (!postResult.ok) {
        setError(postResult.message || 'Failed to load post detail.');
        setPost(null);
      } else {
        setError('');
        setPost(postResult.post || null);
      }

      if (!commentsResult.ok) {
        setCommentError(commentsResult.message || 'Failed to load comments.');
        setComments([]);
      } else {
        setCommentError('');
        setComments(commentsResult.comments || []);
      }

      setLoading(false);
      setCommentsLoading(false);
    }

    loadPost();
    return () => {
      cancelled = true;
    };
  }, [onGetComments, onGetPostDetail, postId]);

  const removePost = async () => {
    setError('');
    setMessage('');
    const result = canSiteModerate
      ? await onAdminRemovePost(postId, reason)
      : await onOwnerRemovePost(post.forum?.id || '', postId, reason);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message);
  };

  const submitComment = async (event) => {
    event.preventDefault();
    setCommentMessage('');
    setCommentError('');

    const content = commentContent.trim();
    if (!content) {
      setCommentError('Please enter a comment.');
      return;
    }

    setSubmittingComment(true);
    const result = await onCreateComment(postId, { content });
    setSubmittingComment(false);

    if (!result.ok || !result.comment) {
      setCommentError(result.message || 'Failed to post comment.');
      return;
    }

    setComments((current) => [...current, result.comment]);
    setCommentContent('');
    setCommentMessage('Comment posted.');
  };

  if (loading) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <p className="muted mb-0">Loading post...</p>
        </section>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <h2 className="mb-2">Post not found</h2>
          <p className="muted mb-3">{error || 'This post may have been removed or is no longer available.'}</p>
          <Link to="/forum" className="forum-primary-btn text-decoration-none">
            Back to Forum
          </Link>
        </section>
      </div>
    );
  }

  const canModeratePost = Boolean(
    currentUser && post?.forum?.ownerId && (canSiteModerate || post.forum.ownerId === currentUser.id)
  );
  const backToForumPath = post?.forum?.slug ? `/forum/${post.forum.slug}` : '/forum';

  return (
    <div className="container page-shell">
      <section className="panel post-detail-shell">
        <div className="post-detail-topbar">
          <Link to={backToForumPath} className="forum-secondary-btn text-decoration-none">
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

        <MarkdownBlock content={post.content} />

        <section className="post-comments-shell">
          <div className="post-comments-header">
            <div>
              <h3 className="mb-1">Comments</h3>
              <p className="muted mb-0">
                {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
              </p>
            </div>
          </div>

          {(commentMessage || commentError) && (
            <div className={`settings-alert ${commentError ? 'is-error' : 'is-success'} mt-3 mb-0`}>
              {commentError || commentMessage}
            </div>
          )}

          {currentUser ? (
            <form className="post-comment-form" onSubmit={submitComment}>
              <label className="form-label" htmlFor="comment-content">Add a comment</label>
              <textarea
                id="comment-content"
                className="form-control forum-input"
                rows={4}
                value={commentContent}
                onChange={(event) => setCommentContent(event.target.value)}
                placeholder="Share your thoughts, feedback, or follow-up question."
                disabled={submittingComment}
              />
              <div className="post-comment-form-footer">
                <span className="muted">Markdown is supported.</span>
                <button type="submit" className="forum-primary-btn" disabled={submittingComment}>
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </form>
          ) : (
            <div className="post-comment-login-note">
              <span className="muted">Login to join the discussion.</span>
              <Link to="/login" className="forum-secondary-btn text-decoration-none">
                Login
              </Link>
            </div>
          )}

          <div className="post-comment-list">
            {commentsLoading ? (
              <p className="muted mb-0">Loading comments...</p>
            ) : comments.length === 0 ? (
              <div className="post-comment-empty">
                <h4 className="mb-2">No comments yet</h4>
                <p className="muted mb-0">Be the first to add context, ask a question, or share an answer.</p>
              </div>
            ) : (
              comments.map((comment) => (
                <article key={comment.id} className="post-comment-card">
                  <div className="post-comment-meta">
                    <Link to={`/users/${comment.authorId}`} className="post-author-link">
                      {comment.authorName}
                    </Link>
                    <span className="muted">{formatTime(comment.createdAt)}</span>
                  </div>
                  <MarkdownBlock content={comment.content} className="post-comment-content" />
                </article>
              ))
            )}
          </div>
        </section>

        {canModeratePost && (
          <section className="settings-card settings-danger-card mt-4">
            <h4 className="mb-2">{canSiteModerate ? 'Admin Moderation' : 'Forum Owner Moderation'}</h4>
            <p className="muted mb-3">
              Remove this post from public view. The author will have 15 days to request restoration.
            </p>
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
