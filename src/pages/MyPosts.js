import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveMediaSource } from '../api';
import { getSectionLabel } from '../lib/sections';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'published', label: 'Published' },
  { value: 'under-review', label: 'Under review' },
  { value: 'removed', label: 'Removed' }
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most-viewed', label: 'Most viewed' }
];

function renderNativeSelectOptions(options) {
  return options.map((item) => (
    <option key={item.value} value={item.value}>
      {item.label}
    </option>
  ));
}

function formatViewCount(value) {
  const count = Number(value || 0);
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1)}K`;
  }
  return String(count);
}

function formatDate(value) {
  const timestamp = Number(value || 0);
  if (!timestamp) {
    return 'Unknown date';
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
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

function getTextPreview(content, maxLength = 140) {
  const plainText = String(content || '')
    .replace(/!\[[^\]]*]\((.*?)\)/g, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#>*_[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength).trimEnd()}...`;
}

function resolvePostStatus(post) {
  const isModerated = Boolean(post.moderation?.isDeleted);
  const isPermanentlyDeleted = Boolean(post.moderation?.isPermanentlyDeleted);

  if (isPermanentlyDeleted) {
    return { key: 'removed', label: 'Removed', tone: 'removed' };
  }
  if (isModerated) {
    return { key: 'under-review', label: 'Under review', tone: 'review' };
  }
  return { key: 'published', label: 'Published', tone: 'published' };
}

function getSortTimestamp(post) {
  return Number(post.updatedAt || post.createdAt || 0);
}

export default function MyPosts({ currentUser, onGetMyPosts, onDeletePost }) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [myPosts, setMyPosts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingPostId, setDeletingPostId] = useState('');

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
        setError(result.message || 'Failed to load your posts.');
        return;
      }

      setError('');
      setMyPosts((result.posts || []).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)));
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [currentUser, onGetMyPosts]);

  const authoredPosts = useMemo(
    () => myPosts.filter((post) => post.authorId === currentUser?.id),
    [myPosts, currentUser]
  );

  const postSummary = useMemo(() => {
    return authoredPosts.reduce((summary, post) => {
      const status = resolvePostStatus(post).key;
      summary.total += 1;
      if (status === 'published') {
        summary.published += 1;
      } else if (status === 'under-review') {
        summary.review += 1;
      } else if (status === 'removed') {
        summary.removed += 1;
      }
      return summary;
    }, {
      total: 0,
      published: 0,
      review: 0,
      removed: 0
    });
  }, [authoredPosts]);

  const visiblePosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = authoredPosts.filter((post) => {
      const status = resolvePostStatus(post).key;
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchBlob = [
        post.title,
        getTextPreview(post.content, 200),
        post.forum?.name || '',
        post.section || ''
      ].join(' ').toLowerCase();

      return searchBlob.includes(query);
    });

    return [...filtered].sort((left, right) => {
      if (sortMode === 'oldest') {
        return getSortTimestamp(left) - getSortTimestamp(right);
      }
      if (sortMode === 'most-viewed') {
        return Number(right.viewCount || 0) - Number(left.viewCount || 0)
          || getSortTimestamp(right) - getSortTimestamp(left);
      }
      return getSortTimestamp(right) - getSortTimestamp(left);
    });
  }, [authoredPosts, searchQuery, sortMode, statusFilter]);

  const handleDeletePost = async (post) => {
    if (!onDeletePost || deletingPostId) {
      return;
    }

    if (!window.confirm(`Delete "${post.title}" permanently?`)) {
      return;
    }

    setDeletingPostId(post.id);
    setError('');
    setNotice('');

    const result = await onDeletePost(post.id);
    if (!result?.ok) {
      setError(result?.message || 'Failed to delete post.');
      setDeletingPostId('');
      return;
    }

    setMyPosts((current) => current.filter((item) => item.id !== post.id));
    setNotice('Post deleted.');
    setDeletingPostId('');
  };

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
      <div className="forum-layout my-posts-surface">
        <div className="forum-main forum-main-full">
          <section className="my-posts-header mb-3" aria-label="My posts controls">
            <div className="my-posts-heading-row">
              <div>
                <h1 className="community-feed-title mb-1">My Posts</h1>
                <p className="my-posts-subtext mb-0">Manage and revisit what you&apos;ve published.</p>
              </div>
              <span className="community-feed-count">
                {visiblePosts.length}
                {authoredPosts.length !== visiblePosts.length ? ` of ${authoredPosts.length}` : ''} posts
              </span>
            </div>

            <div className="my-posts-summary-row" aria-label="Post summary">
              <span className="my-posts-summary-chip">Total {postSummary.total}</span>
              <span className="my-posts-summary-chip">Published {postSummary.published}</span>
              <span className="my-posts-summary-chip">Under review {postSummary.review}</span>
              <span className="my-posts-summary-chip">Removed {postSummary.removed}</span>
            </div>

            <div className="community-feed-control-bar my-posts-control-bar">
              <label className="community-feed-control">
                <span className="community-feed-control-label">Status</span>
                <div className="forum-native-select-wrap">
                  <select
                    className="forum-native-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    {renderNativeSelectOptions(STATUS_FILTER_OPTIONS)}
                  </select>
                </div>
              </label>

              <label className="community-feed-control">
                <span className="community-feed-control-label">Sort</span>
                <div className="forum-native-select-wrap">
                  <select
                    className="forum-native-select"
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value)}
                  >
                    {renderNativeSelectOptions(SORT_OPTIONS)}
                  </select>
                </div>
              </label>

              <div className="community-feed-search">
                <input
                  className="form-control forum-input tag-search-input"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search your posts"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="community-feed-search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="forum-feed-panel">
            <div className="my-posts-toolbar-row">
              <Link to="/forum?compose=1" className="forum-primary-btn text-decoration-none">
                Create post
              </Link>
              <Link to="/forum" className="forum-secondary-btn text-decoration-none">
                Back to feed
              </Link>
            </div>

            {error && <div className="settings-alert is-error mb-3">{error}</div>}
            {notice && <div className="settings-alert is-success mb-3">{notice}</div>}

            <div className="forum-feed discovery-feed-grid my-posts-discovery-grid">
              {visiblePosts.map((post) => {
                const status = resolvePostStatus(post);
                const coverImage = getPostCoverImage(post.content);
                const hasImage = Boolean(String(coverImage || '').trim());
                const previewText = getTextPreview(post.content);
                const metaDateLabel = post.updatedAt && Number(post.updatedAt) !== Number(post.createdAt)
                  ? `Updated ${formatDate(post.updatedAt)}`
                  : `Published ${formatDate(post.createdAt)}`;
                const hasAppealHistory = Boolean(post.moderation?.appealRequestedAt) || (post.moderation?.appealLog || []).length > 0;
                const canDelete = status.key !== 'under-review' && typeof onDeletePost === 'function';
                const appealPath = status.key === 'under-review'
                  ? `/my-posts/${post.id}/appeal`
                  : (status.key === 'removed' && hasAppealHistory ? `/my-posts/${post.id}/appeal` : '');

                return (
                  <article key={post.id} className={`discovery-post-tile my-posts-tile ${hasImage ? 'has-image' : 'is-text-cover'}`.trim()}>
                    <Link to={`/forum/post/${post.id}`} className="discovery-post-cover-link" aria-label={post.title}>
                      <div className={`discovery-post-cover ${hasImage ? 'has-image' : 'is-text-cover'}`.trim()}>
                        {hasImage ? (
                          <img
                            src={coverImage}
                            alt={post.title}
                            className="discovery-post-cover-image"
                            loading="lazy"
                          />
                        ) : (
                          <div className="discovery-post-text-cover">
                            <span className="discovery-post-text-cover-title">{post.title}</span>
                          </div>
                        )}
                        <div className="discovery-post-cover-meta">
                          <span className="discovery-post-cover-space">{post.forum?.name || 'General'}</span>
                          <span className="discovery-post-cover-section">{getSectionLabel(post.section)}</span>
                        </div>
                      </div>
                    </Link>

                    <div className="discovery-post-content my-posts-card-content">
                      {hasImage ? (
                        <h3 className="discovery-post-title">
                          <Link to={`/forum/post/${post.id}`}>{post.title}</Link>
                        </h3>
                      ) : null}

                      <p className="my-posts-card-excerpt">
                        <Link to={`/forum/post/${post.id}`}>{previewText || post.title}</Link>
                      </p>

                      <div className="my-posts-meta-row">
                        <span className="discovery-post-views">{formatViewCount(post.viewCount)} views</span>
                        <span className="my-posts-meta-date">{metaDateLabel}</span>
                      </div>

                      <div className="my-posts-card-foot">
                        <span className={`my-posts-status-pill is-${status.tone}`}>{status.label}</span>
                        <div className="my-posts-tools">
                          <Link to={`/forum/post/${post.id}`} className="my-posts-tool-link">
                            View
                          </Link>
                          {status.key === 'published' ? (
                            <Link to={`/my-posts/${post.id}/edit`} className="my-posts-tool-link">
                              Edit
                            </Link>
                          ) : null}
                          {appealPath ? (
                            <Link to={appealPath} className="my-posts-tool-link">
                              {status.key === 'under-review' ? 'Appeal' : 'Appeal record'}
                            </Link>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              className={`my-posts-tool-link is-danger ${deletingPostId === post.id ? 'is-disabled' : ''}`.trim()}
                              onClick={() => { void handleDeletePost(post); }}
                              disabled={deletingPostId === post.id}
                            >
                              {deletingPostId === post.id ? 'Deleting...' : 'Delete'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              {visiblePosts.length === 0 ? (
                <section className="my-posts-empty-state" aria-label="No posts">
                  <h2 className="my-posts-empty-title mb-0">
                    {searchQuery || statusFilter !== 'all'
                      ? 'No posts match this view'
                      : 'You haven’t published anything yet'}
                  </h2>
                  <p className="my-posts-empty-copy mb-0">
                    {searchQuery || statusFilter !== 'all'
                      ? 'Try another filter or search term to find your posts.'
                      : 'Publish your first post to start building your personal content library.'}
                  </p>
                  <div className="my-posts-empty-actions">
                    <Link to="/forum?compose=1" className="forum-primary-btn text-decoration-none">
                      Start your first post
                    </Link>
                  </div>
                </section>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
