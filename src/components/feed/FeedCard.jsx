import React from 'react';
import { Link } from 'react-router-dom';
import { getSectionLabel } from '../../lib/sections';

function getAuthorInitial(name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    return 'T';
  }
  return cleanName.slice(0, 1).toUpperCase();
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

export default function FeedCard({
  post,
  coverImage,
  textPreview,
  isAggregateView,
  canManage,
  onModerate
}) {
  const hasImage = Boolean(String(coverImage || '').trim());
  const postLink = `/forum/post/${post.id}`;
  const authorLink = `/users/${post.authorId}`;
  const sectionLabel = getSectionLabel(post.section);
  const forumName = post.forum?.name || 'General';

  return (
    <article className={`discovery-post-tile ${hasImage ? 'has-image' : 'is-text-cover'}`.trim()}>
      <Link to={postLink} className="discovery-post-cover-link" aria-label={post.title}>
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
            <span className="discovery-post-cover-space">{forumName}</span>
            {!isAggregateView ? <span className="discovery-post-cover-section">{sectionLabel}</span> : null}
          </div>
        </div>
      </Link>

      <div className="discovery-post-content">
        {hasImage ? (
          <h3 className="discovery-post-title">
            <Link to={postLink}>{post.title}</Link>
          </h3>
        ) : (
          <p className="discovery-post-excerpt">
            <Link to={postLink}>{textPreview || post.title}</Link>
          </p>
        )}

        <div className="discovery-post-footer">
          <Link to={authorLink} className="discovery-post-author">
            {post.authorAvatarUrl ? (
              <img
                src={post.authorAvatarUrl}
                alt={post.authorName}
                className="discovery-post-author-avatar-image"
              />
            ) : (
              <span className="discovery-post-author-avatar" aria-hidden="true">{getAuthorInitial(post.authorName)}</span>
            )}
            <span className="discovery-post-author-name">{post.authorName}</span>
          </Link>
          <span className="discovery-post-views">{formatViewCount(post.viewCount)} views</span>
        </div>

        {canManage ? (
          <div className="discovery-post-tools">
            <button type="button" className="discovery-post-remove-btn" onClick={onModerate}>
              Remove
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
