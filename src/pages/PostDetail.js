import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRecordPostView, apiTrackPostEngagement, resolveMediaSource } from '../api';
import Avatar from '../components/Avatar';
import MarkdownBlock from '../components/MarkdownBlock';
import PostEngagementBar from '../components/post/PostEngagementBar';
import { authStorage } from '../lib/authStorage';
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

function readAdminModeForUser(user) {
  if (!user?.id) {
    return false;
  }

  const hasAdminCapability = Boolean(
    user.isAdmin
    || user.hasAdminAccess
    || user.canManageAdminAccess
    || (user.adminPermissions || []).length > 0
  );

  if (!hasAdminCapability || typeof window === 'undefined') {
    return false;
  }

  try {
    return window.sessionStorage.getItem(`tsumit.adminMode.${user.id}`) === '1';
  } catch (_) {
    return false;
  }
}

export default function PostDetail({
  currentUser,
  onAdminRemovePost,
  onOwnerRemovePost,
  onGetPostDetail,
  onToggleLike,
  onToggleBookmark,
  onGetComments,
  onCreateComment
}) {
  const VIEW_DEDUPE_WINDOW_MS = 4000;
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
  const [isAdminModeEnabled, setIsAdminModeEnabled] = useState(() => readAdminModeForUser(currentUser));
  const engagementSessionRef = useRef({ lastVisibleAt: 0, accruedMs: 0 });
  const hasAdminCapability = Boolean(
    currentUser?.isAdmin
    || currentUser?.hasAdminAccess
    || currentUser?.canManageAdminAccess
    || (currentUser?.adminPermissions || []).length > 0
  );
  const canSiteModerate = Boolean(
    isAdminModeEnabled
    && (currentUser?.isAdmin || currentUser?.adminPermissions?.includes('moderation'))
  );

  useEffect(() => {
    if (!post) {
      applySeo({
        title: buildPageTitle('Post'),
        description: 'Read technical posts and community discussion on tsumit.',
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

  useEffect(() => {
    if (!postId || typeof window === 'undefined') {
      return;
    }

    const storageKey = `tsumit-post-view:${postId}`;
    const lastViewedAt = Number(window.sessionStorage.getItem(storageKey) || 0);
    if (Date.now() - lastViewedAt < VIEW_DEDUPE_WINDOW_MS) {
      return;
    }

    window.sessionStorage.setItem(storageKey, String(Date.now()));
    void apiRecordPostView(postId, authStorage.getToken() || undefined).catch(() => {});
  }, [postId]);

  useEffect(() => {
    if (!postId || !currentUser?.id || typeof window === 'undefined') {
      return undefined;
    }

    const token = authStorage.getToken();
    if (!token) {
      return undefined;
    }

    const session = engagementSessionRef.current;
    session.accruedMs = 0;
    session.lastVisibleAt = document.visibilityState === 'hidden' ? 0 : Date.now();

    const flushDwellTime = () => {
      if (session.lastVisibleAt) {
        session.accruedMs += Date.now() - session.lastVisibleAt;
        session.lastVisibleAt = 0;
      }

      const dwellTimeMs = Math.trunc(session.accruedMs);
      if (dwellTimeMs < 1500) {
        return;
      }

      session.accruedMs = 0;
      void apiTrackPostEngagement(postId, { dwellTimeMs, source: 'post_detail' }, token)
        .catch(() => {
          session.accruedMs += dwellTimeMs;
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushDwellTime();
        return;
      }

      if (!session.lastVisibleAt) {
        session.lastVisibleAt = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushDwellTime);
    window.addEventListener('beforeunload', flushDwellTime);

    return () => {
      flushDwellTime();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushDwellTime);
      window.removeEventListener('beforeunload', flushDwellTime);
    };
  }, [currentUser?.id, postId]);

  useEffect(() => {
    setIsAdminModeEnabled(readAdminModeForUser(currentUser));
  }, [currentUser]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncAdminMode = (event) => {
      if (!currentUser?.id) {
        setIsAdminModeEnabled(false);
        return;
      }

      const eventUserId = event?.detail?.userId;
      if (eventUserId && eventUserId !== currentUser.id) {
        return;
      }

      setIsAdminModeEnabled(readAdminModeForUser(currentUser));
    };

    window.addEventListener('tsumit:admin-mode-changed', syncAdminMode);
    window.addEventListener('storage', syncAdminMode);
    return () => {
      window.removeEventListener('tsumit:admin-mode-changed', syncAdminMode);
      window.removeEventListener('storage', syncAdminMode);
    };
  }, [currentUser]);

  const removePost = async () => {
    setError('');
    setMessage('');

    if (!post?.forum?.id || !currentUser) {
      setError('You do not have permission to remove this post.');
      return;
    }

    if (hasAdminCapability && !isAdminModeEnabled) {
      setError('Admin mode is off. Enable Admin mode to access moderation actions.');
      return;
    }

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

  const syncInteractionState = (interaction) => {
    if (!interaction?.postId) {
      return;
    }

    setPost((current) => (
      current && current.id === interaction.postId
        ? {
          ...current,
          likeCount: interaction.likeCount,
          bookmarkCount: interaction.bookmarkCount,
          isLiked: interaction.isLiked,
          isBookmarked: interaction.isBookmarked,
          savedAt: interaction.savedAt ?? null
        }
        : current
    ));
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
            Back to Feed
          </Link>
        </section>
      </div>
    );
  }

  const canModeratePost = Boolean(
    currentUser
    && post?.forum?.ownerId
    && !(hasAdminCapability && !isAdminModeEnabled)
    && (canSiteModerate || post.forum.ownerId === currentUser.id)
  );
  const normalizedSection = String(post?.section || '').trim();
  const scopedSections = Array.isArray(post?.forum?.sectionScope) ? post.forum.sectionScope : [];
  const resolvedSectionValue = scopedSections.find(
    (value) => String(value || '').trim().toLowerCase() === normalizedSection.toLowerCase()
  ) || normalizedSection;
  const sectionLinkTarget = resolvedSectionValue
    ? (post?.forum?.slug
      ? `/forum/${post.forum.slug}/section/${encodeURIComponent(resolvedSectionValue)}`
      : `/forum?section=${encodeURIComponent(resolvedSectionValue)}`)
    : '';

  return (
    <div className="container page-shell">
      <section className="panel post-detail-shell">
        <div className="post-detail-topbar">
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">
            Back to Feed
          </Link>
          <span className="muted">{formatTime(post.createdAt)}</span>
        </div>

        <div className="post-detail-meta">
          <div className="post-detail-meta-inline">
            <Link to={`/users/${post.authorId}`} className="post-author-link post-detail-author-link">
              <Avatar
                imageUrl={resolveMediaSource(post.authorAvatarUrl)}
                name={post.authorName}
                size={34}
                className="post-detail-author-avatar"
              />
              <span className="post-detail-author-name">{post.authorName}</span>
            </Link>

            {!!post.forum?.name && (
              <>
                <span className="post-detail-meta-separator" aria-hidden="true">·</span>
                {post.forum?.slug ? (
                  <Link to={`/forum/${post.forum.slug}`} className="post-detail-context-link">
                    {post.forum.name}
                  </Link>
                ) : (
                  <span className="post-detail-context-text">{post.forum.name}</span>
                )}
              </>
            )}

            {!!resolvedSectionValue && (
              <>
                <span className="post-detail-meta-separator" aria-hidden="true">·</span>
                {sectionLinkTarget ? (
                  <Link to={sectionLinkTarget} className="post-detail-context-link">
                    {getSectionLabel(resolvedSectionValue)}
                  </Link>
                ) : (
                  <span className="post-detail-context-text">{getSectionLabel(resolvedSectionValue)}</span>
                )}
              </>
            )}
          </div>
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

        <PostEngagementBar
          post={post}
          currentUser={currentUser}
          onToggleLike={onToggleLike}
          onToggleBookmark={onToggleBookmark}
          onStateChange={syncInteractionState}
          className="mb-3"
        />

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
                    <Link to={`/users/${comment.authorId}`} className="post-author-link post-comment-author-link">
                      <Avatar
                        imageUrl={resolveMediaSource(comment.authorAvatarUrl)}
                        name={comment.authorName}
                        size={34}
                        className="post-comment-avatar"
                      />
                      <span className="post-comment-author-name">{comment.authorName}</span>
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
            <h4 className="mb-2">{canSiteModerate ? 'Admin Moderation' : 'Space Owner Moderation'}</h4>
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
