import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveMediaSource } from '../api';
import FeedCard from '../components/feed/FeedCard';

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

function getTextPreview(content, maxLength = 150) {
  const text = String(content || '')
    .replace(/!\[[^\]]*]\((.*?)\)/g, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#>*_[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

export default function SavedPosts({
  currentUser,
  onGetSavedPosts,
  onToggleLike,
  onToggleBookmark
}) {
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    void onGetSavedPosts().then((result) => {
      if (cancelled) {
        return;
      }

      if (!result?.ok) {
        setError(result?.message || 'Failed to load saved posts.');
        setSavedPosts([]);
        setLoading(false);
        return;
      }

      setError('');
      setSavedPosts(result.posts || []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser, onGetSavedPosts]);

  const feedCards = useMemo(() => (
    savedPosts.map((post) => ({
      post,
      coverImage: getPostCoverImage(post.content),
      textPreview: getTextPreview(post.content)
    }))
  ), [savedPosts]);

  const syncInteractionState = (postId, interaction) => {
    if (!interaction?.postId) {
      return;
    }

    setSavedPosts((current) => current.map((post) => (
      post.id === postId
        ? {
          ...post,
          likeCount: interaction.likeCount,
          bookmarkCount: interaction.bookmarkCount,
          isLiked: interaction.isLiked,
          isBookmarked: interaction.isBookmarked,
          savedAt: interaction.savedAt ?? null
        }
        : post
    )));
  };

  const handleToggleLike = async (postId, nextLiked) => {
    const previousPosts = savedPosts;
    setSavedPosts((current) => current.map((post) => (
      post.id === postId
        ? {
          ...post,
          likeCount: Math.max(0, Number(post.likeCount || 0) + (nextLiked ? 1 : -1)),
          isLiked: nextLiked
        }
        : post
    )));

    const result = await onToggleLike(postId, nextLiked);
    if (result?.ok && result.interaction) {
      syncInteractionState(postId, result.interaction);
      return result;
    }

    setSavedPosts(previousPosts);
    return result;
  };

  const handleToggleBookmark = async (postId, nextBookmarked) => {
    const previousPosts = savedPosts;
    if (nextBookmarked) {
      setSavedPosts((current) => current.map((post) => (
        post.id === postId
          ? {
            ...post,
            bookmarkCount: Number(post.bookmarkCount || 0) + 1,
            isBookmarked: true,
            savedAt: Date.now()
          }
          : post
      )));
    } else {
      setSavedPosts((current) => current.filter((post) => post.id !== postId));
      setNotice('Removed from saved posts.');
    }

    const result = await onToggleBookmark(postId, nextBookmarked);
    if (!result?.ok || !result.interaction) {
      setSavedPosts(previousPosts);
      setNotice('');
      return result;
    }

    if (result.interaction.isBookmarked) {
      syncInteractionState(postId, result.interaction);
      return result;
    }

    setSavedPosts((current) => current.filter((post) => post.id !== postId));
    setNotice('Removed from saved posts.');
    return result;
  };

  if (!currentUser) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <h2 className="mb-2">Saved Posts</h2>
          <p className="muted mb-3">Login to keep track of posts you want to revisit.</p>
          <Link to="/login" className="forum-primary-btn text-decoration-none">Login</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <div className="forum-layout my-posts-surface">
        <div className="forum-main forum-main-full">
          <section className="my-posts-header mb-3" aria-label="Saved posts">
            <div className="my-posts-heading-row">
              <div>
                <h1 className="community-feed-title mb-1">Saved Posts</h1>
                <p className="my-posts-subtext mb-0">A quiet place to come back to what mattered.</p>
              </div>
              <span className="community-feed-count">{savedPosts.length} saved</span>
            </div>
          </section>

          {error ? <div className="settings-alert is-error mb-3">{error}</div> : null}
          {notice ? <div className="settings-alert is-success mb-3">{notice}</div> : null}
          {loading ? <p className="muted mb-0">Loading saved posts...</p> : null}

          {!loading && feedCards.length > 0 ? (
            <div className="forum-feed discovery-feed-grid profile-post-grid">
              {feedCards.map(({ post, coverImage, textPreview }) => (
                <FeedCard
                  key={post.id}
                  post={post}
                  coverImage={coverImage}
                  textPreview={textPreview}
                  isAggregateView={false}
                  currentUser={currentUser}
                  onToggleLike={handleToggleLike}
                  onToggleBookmark={handleToggleBookmark}
                  canManage={false}
                  onModerate={() => {}}
                />
              ))}
            </div>
          ) : null}

          {!loading && feedCards.length === 0 ? (
            <section className="saved-posts-empty-state">
              <h2 className="my-posts-empty-title mb-0">Nothing saved yet</h2>
              <p className="my-posts-empty-copy mb-0">
                Save posts from the feed or post detail page and they&apos;ll show up here.
              </p>
              <Link to="/forum" className="forum-secondary-btn text-decoration-none">
                Browse posts
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
