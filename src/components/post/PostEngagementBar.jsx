import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function formatCompactCount(value) {
  const count = Number(value || 0);
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

function HeartIcon({ active = false }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M10 17.3 8.9 16.3C4.6 12.4 2 10 2 6.9A4 4 0 0 1 6 3c1.6 0 3 .7 4 1.9A5.2 5.2 0 0 1 14 3a4 4 0 0 1 4 3.9c0 3.1-2.6 5.5-6.9 9.4L10 17.3Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookmarkIcon({ active = false }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M6 3.5h8A1.5 1.5 0 0 1 15.5 5v11.4L10 13.5l-5.5 2.9V5A1.5 1.5 0 0 1 6 3.5Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PostEngagementBar({
  post,
  currentUser,
  onToggleLike,
  onToggleBookmark,
  onStateChange,
  compact = false,
  className = ''
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingAction, setPendingAction] = useState('');
  const [optimisticState, setOptimisticState] = useState(() => ({
    likeCount: Number(post?.likeCount || 0),
    bookmarkCount: Number(post?.bookmarkCount || 0),
    isLiked: Boolean(post?.isLiked),
    isBookmarked: Boolean(post?.isBookmarked),
    savedAt: post?.savedAt ?? null
  }));

  useEffect(() => {
    setOptimisticState({
      likeCount: Number(post?.likeCount || 0),
      bookmarkCount: Number(post?.bookmarkCount || 0),
      isLiked: Boolean(post?.isLiked),
      isBookmarked: Boolean(post?.isBookmarked),
      savedAt: post?.savedAt ?? null
    });
  }, [post?.bookmarkCount, post?.id, post?.isBookmarked, post?.isLiked, post?.likeCount, post?.savedAt]);

  const likeCount = Number(optimisticState.likeCount || 0);
  const bookmarkCount = Number(optimisticState.bookmarkCount || 0);
  const isLiked = Boolean(optimisticState.isLiked);
  const isBookmarked = Boolean(optimisticState.isBookmarked);

  const promptSignIn = () => {
    navigate('/login', {
      state: {
        from: `${location.pathname}${location.search}`
      }
    });
  };

  const handleToggle = async (action, nextState, handler) => {
    if (!handler || pendingAction) {
      return;
    }
    if (!currentUser) {
      promptSignIn();
      return;
    }

    const previousState = optimisticState;
    setOptimisticState((current) => {
      if (action === 'like') {
        return {
          ...current,
          isLiked: nextState,
          likeCount: Math.max(0, Number(current.likeCount || 0) + (nextState ? 1 : -1))
        };
      }

      return {
        ...current,
        isBookmarked: nextState,
        bookmarkCount: Math.max(0, Number(current.bookmarkCount || 0) + (nextState ? 1 : -1)),
        savedAt: nextState ? Date.now() : null
      };
    });

    setPendingAction(action);
    const result = await handler(post.id, nextState);
    setPendingAction('');

    if (result?.ok && result.interaction) {
      if (onStateChange) {
        onStateChange(result.interaction);
      }
      setOptimisticState({
        likeCount: Number(result.interaction.likeCount || 0),
        bookmarkCount: Number(result.interaction.bookmarkCount || 0),
        isLiked: Boolean(result.interaction.isLiked),
        isBookmarked: Boolean(result.interaction.isBookmarked),
        savedAt: result.interaction.savedAt ?? null
      });
      return;
    }

    if (!result?.ok) {
      setOptimisticState(previousState);
    }
  };

  return (
    <div className={`post-engagement-bar ${compact ? 'is-compact' : 'is-detail'} ${className}`.trim()}>
      <button
        type="button"
        className={`post-engagement-btn ${isLiked ? 'is-active' : ''}`.trim()}
        onClick={() => handleToggle('like', !isLiked, onToggleLike)}
        disabled={pendingAction === 'like'}
        aria-pressed={isLiked}
      >
        <span className="post-engagement-btn-icon"><HeartIcon active={isLiked} /></span>
        <span className="post-engagement-btn-label">{isLiked ? 'Liked' : 'Like'}</span>
        <span className="post-engagement-btn-count">{formatCompactCount(likeCount)}</span>
      </button>

      <button
        type="button"
        className={`post-engagement-btn ${isBookmarked ? 'is-active is-bookmarked' : ''}`.trim()}
        onClick={() => handleToggle('bookmark', !isBookmarked, onToggleBookmark)}
        disabled={pendingAction === 'bookmark'}
        aria-pressed={isBookmarked}
      >
        <span className="post-engagement-btn-icon"><BookmarkIcon active={isBookmarked} /></span>
        <span className="post-engagement-btn-label">{isBookmarked ? 'Saved' : 'Save'}</span>
        <span className="post-engagement-btn-count">{formatCompactCount(bookmarkCount)}</span>
      </button>
    </div>
  );
}
