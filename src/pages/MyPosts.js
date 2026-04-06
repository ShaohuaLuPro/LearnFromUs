import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Select from '../components/Select';
import { resolveMediaSource } from '../api';

const postFilterOptions = [
  { value: 'all', label: 'All Posts' },
  { value: 'successful', label: 'Successful Posts' },
  { value: 'appeal', label: 'Appeal' },
  { value: 'permanent-deleted', label: 'Permanent Deleted' }
];

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTextPreview(content) {
  return String(content || '')
    .replace(/!\[[^\]]*]\((.*?)\)/g, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#>*_[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSparseFeedThreshold(viewportWidth) {
  if (viewportWidth >= 1280) {
    return 4;
  }
  if (viewportWidth >= 768) {
    return 3;
  }
  return 2;
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

function getUserAvatarInitial(name) {
  const cleanName = String(name || '').trim();
  return cleanName ? cleanName.slice(0, 1).toUpperCase() : 'T';
}

function getSectionName(section) {
  return String(section || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function MyPosts({ currentUser, onGetMyPosts }) {
  const message = '';
  const [error, setError] = useState('');
  const [myPosts, setMyPosts] = useState([]);
  const [selectedPostFilter, setSelectedPostFilter] = useState('all');
  const [viewportWidth, setViewportWidth] = useState(() => (
    typeof window === 'undefined' ? 1440 : window.innerWidth
  ));

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      const result = await onGetMyPosts();
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMyPosts((result.posts || []).sort((a, b) => b.createdAt - a.createdAt));
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [currentUser, onGetMyPosts]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    function handleResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const authoredPosts = useMemo(
    () => myPosts.filter((post) => post.authorId === currentUser?.id),
    [myPosts, currentUser]
  );

  const visiblePosts = useMemo(() => (
    authoredPosts.filter((post) => {
      const isModerated = Boolean(post.moderation?.isDeleted);
      const isPermanentlyDeleted = Boolean(post.moderation?.isPermanentlyDeleted);

      if (selectedPostFilter === 'successful') {
        return !isModerated;
      }
      if (selectedPostFilter === 'appeal') {
        return isModerated && !isPermanentlyDeleted;
      }
      if (selectedPostFilter === 'permanent-deleted') {
        return isPermanentlyDeleted;
      }
      return true;
    })
  ), [authoredPosts, selectedPostFilter]);

  const shouldUseSparseFeed = useMemo(() => {
    if (selectedPostFilter === 'appeal' || selectedPostFilter === 'permanent-deleted') {
      return false;
    }
    const threshold = getSparseFeedThreshold(viewportWidth);
    return visiblePosts.length > 0 && visiblePosts.length <= threshold;
  }, [selectedPostFilter, viewportWidth, visiblePosts.length]);

  if (!currentUser) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <h2 className="mb-2">My Posts</h2>
          <p className="muted mb-3">You need to be logged in to manage your posts.</p>
          <Link to="/login" className="forum-primary-btn text-decoration-none">Login</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <section className="panel my-posts-panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-2">Workspace</p>
            <h2 className="mb-1 type-title-md">My Posts</h2>
            <p className="type-body mb-0">Open a clean edit page for drafts and use appeal only when a post enters moderation.</p>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="forum-feed-switcher">
              <Select
                options={postFilterOptions}
                value={selectedPostFilter}
                onChange={setSelectedPostFilter}
                placeholder="Choose posts"
                triggerClassName="forum-feed-switcher-trigger"
                menuClassName="forum-feed-switcher-menu"
              />
            </div>
            <Link to="/forum" className="forum-secondary-btn text-decoration-none">Back to Feed</Link>
          </div>
        </div>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-3`}>
            {error || message}
          </div>
        )}

        <div className={`forum-feed my-posts-feed ${shouldUseSparseFeed ? 'is-sparse' : ''}`.trim()}>
          {visiblePosts.map((post) => {
            const isModerated = Boolean(post.moderation?.isDeleted);
            const isPermanentlyDeleted = Boolean(post.moderation?.isPermanentlyDeleted);
            const coverImage = getPostCoverImage(post.content);
            const textPreview = getTextPreview(post.content);
            const cardSummary = textPreview && textPreview !== post.title ? textPreview : '';
            const appealLog = post.moderation?.appealLog || [];
            const hasAppealHistory = appealLog.length > 0 || Boolean(post.moderation?.appealRequestedAt);
            const primaryAction = selectedPostFilter === 'appeal'
              ? {
                to: `/my-posts/${post.id}/appeal`,
                label: 'Appeal',
                className: 'forum-secondary-btn'
              }
              : !isPermanentlyDeleted
                ? {
                  to: `/my-posts/${post.id}/edit`,
                  label: 'Edit',
                  className: 'forum-primary-btn'
                }
                : hasAppealHistory
                  ? {
                    to: `/my-posts/${post.id}/appeal`,
                    label: 'Appeal Record',
                    className: 'forum-secondary-btn'
                  }
                  : null;

            return (
              <article key={post.id} className={`forum-post-card ${isModerated ? 'moderated-post-card' : ''}`}>
                <Link to={`/forum/post/${post.id}`} className="forum-post-cover-link">
                  <div className={`forum-post-cover ${coverImage ? 'has-image' : 'is-title-only'}`.trim()}>
                    {coverImage ? (
                      <img
                        src={coverImage}
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
                      <span className="forum-tag">{getSectionName(post.section)}</span>
                    </div>
                  </div>
                </Link>

                <div className="forum-post-card-body my-posts-card-body">
                  {coverImage ? (
                    <h5 className="mb-0 forum-post-card-title">
                      <Link to={`/forum/post/${post.id}`} className="post-title-link">
                        {post.title}
                      </Link>
                    </h5>
                  ) : (
                    <p className="mb-0 forum-post-card-summary">
                      <Link to={`/forum/post/${post.id}`} className="forum-post-summary-link">
                        {cardSummary || post.title}
                      </Link>
                    </p>
                  )}

                  <div className="forum-post-card-meta">
                    <span className="forum-post-author-link">
                      {currentUser?.avatarUrl ? (
                        <img
                          src={currentUser.avatarUrl}
                          alt={currentUser.name}
                          className="forum-post-author-avatar-image"
                        />
                      ) : (
                        <span className="forum-post-author-avatar" aria-hidden="true">{getUserAvatarInitial(currentUser?.name)}</span>
                      )}
                      <span className="forum-post-author-name">You</span>
                    </span>
                    <span className="forum-post-card-views">{formatTime(post.createdAt)}</span>
                  </div>

                  <div className="forum-post-card-submeta my-posts-card-footer">
                    <span className={`my-posts-card-status ${(isModerated || isPermanentlyDeleted) ? 'is-muted' : 'is-live'}`}>
                      {isPermanentlyDeleted
                        ? 'Final decision recorded'
                        : selectedPostFilter === 'appeal'
                          ? 'Appeal in progress'
                          : isModerated
                            ? 'Appeal available'
                            : 'Ready to edit'}
                    </span>
                    {primaryAction ? (
                      <Link to={primaryAction.to} className={`${primaryAction.className} text-decoration-none`}>
                        {primaryAction.label}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}

          {visiblePosts.length === 0 && (
            <section className="settings-card">
              <h4 className="mb-2">
                {selectedPostFilter === 'all' ? 'No posts yet' : 'No posts in this category'}
              </h4>
              <p className="muted mb-3">
                {selectedPostFilter === 'all'
                  ? 'Once you publish to the feed, your posts will appear here for editing or appeal review.'
                  : selectedPostFilter === 'permanent-deleted'
                    ? 'Posts that receive a final permanent delete decision will appear here.'
                    : 'Try another filter or create a new post to populate this view.'}
              </p>
              {selectedPostFilter !== 'permanent-deleted' && (
                <Link to="/forum" className="forum-primary-btn text-decoration-none">Create Your First Post</Link>
              )}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
