import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGetFollowing } from '../api';
import { authStorage } from '../lib/authStorage';
import { getSectionLabel } from '../lib/sections';

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getPreview(content) {
  const text = String(content || '').trim().replace(/\s+/g, ' ');
  if (text.length <= 88) {
    return text;
  }
  return `${text.slice(0, 88).trimEnd()}...`;
}

export default function ForumSidebar({ currentUser, forums = [], currentForum = null }) {
  const [followedPosts, setFollowedPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [message, setMessage] = useState('');
  const followedForums = forums.filter((forum) => forum.isFollowing);
  const visibleFollowedForums = followedForums.slice(0, 3);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowedPosts() {
      if (!currentUser) {
        setFollowedPosts([]);
        setMessage('');
        setLoadingPosts(false);
        return;
      }

      const token = authStorage.getToken();
      if (!token) {
        setFollowedPosts([]);
        setMessage('Please login first.');
        setLoadingPosts(false);
        return;
      }

      setLoadingPosts(true);
      setMessage('');
      try {
        const data = await apiGetFollowing(token);
        if (!cancelled) {
          setFollowedPosts((data.posts || []).slice(0, 8));
        }
      } catch (error) {
        if (!cancelled) {
          setFollowedPosts([]);
          setMessage(error instanceof Error ? error.message : 'Failed to load followed posts.');
        }
      } finally {
        if (!cancelled) {
          setLoadingPosts(false);
        }
      }
    }

    loadFollowedPosts();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  return (
    <aside className="forum-sidebar">
      <section className="panel forum-sidebar-card forum-sidebar-card-header">
        <div className="forum-floating-header">
          <div>
            <p className="type-kicker mb-1">Workspace</p>
            <h3 className="mb-0 type-title-md">Apply for a Forum</h3>
          </div>
          <Link to="/forums/request" className="forum-primary-btn text-decoration-none">
            Open Request
          </Link>
        </div>
      </section>

      <section className="panel forum-sidebar-card">
        <div className="forum-sidebar-section-head">
          <div>
            <p className="type-kicker mb-1">Forums</p>
            <h4 className="mb-0 type-title-sm">Followed Forums</h4>
          </div>
          <span className="muted">{followedForums.length}</span>
        </div>

        {!currentUser ? (
          <div className="forum-follow-empty">
            <p className="muted mb-3">Login to save forums you want to revisit quickly.</p>
            <Link to="/login" className="forum-secondary-btn text-decoration-none">
              Login
            </Link>
          </div>
        ) : followedForums.length === 0 ? (
          <div className="forum-follow-empty">
            <p className="muted mb-0">
              Follow forums to pin them here.
              {currentForum?.name ? ` Start with ${currentForum.name}.` : ''}
            </p>
          </div>
        ) : (
          <div className="forum-follow-list">
            {visibleFollowedForums.map((forum) => (
              <Link key={forum.id} to={`/forum/${forum.slug}`} className="forum-follow-card">
                <div className="forum-follow-card-topline">
                  <span className="forum-tag">{forum.isCore ? 'Core Forum' : 'Community Forum'}</span>
                  <span className="muted">{forum.followerCount ?? 0} followers</span>
                </div>
                <strong>{forum.name}</strong>
                <span className="forum-follow-meta">{forum.livePostCount ?? forum.postCount ?? 0} posts</span>
                <span className="forum-follow-meta">
                  {(forum.sectionScope || []).slice(0, 3).map((section) => getSectionLabel(section)).join(' · ')
                    || 'Forum details'}
                </span>
              </Link>
            ))}
            {followedForums.length > 3 && (
              <Link to="/following?tab=forums" className="forum-secondary-btn text-decoration-none">
                More
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="panel forum-sidebar-card">
        <div className="forum-sidebar-section-head">
          <div>
            <p className="type-kicker mb-1">People</p>
            <h4 className="mb-0 type-title-sm">Following Feed</h4>
          </div>
        </div>

        {!currentUser ? (
          <div className="forum-follow-empty">
            <p className="muted mb-3">Login to see posts from the people you follow.</p>
            <Link to="/login" className="forum-secondary-btn text-decoration-none">
              Login
            </Link>
          </div>
        ) : loadingPosts ? (
          <p className="muted mb-0">Loading followed posts...</p>
        ) : message ? (
          <p className="muted mb-0">{message}</p>
        ) : followedPosts.length === 0 ? (
          <div className="forum-follow-empty">
            <p className="muted mb-3">No posts from people you follow yet.</p>
            <Link to="/following" className="forum-secondary-btn text-decoration-none">
              Manage Following
            </Link>
          </div>
        ) : (
          <div className="forum-follow-list">
            {followedPosts.map((post) => (
              <Link key={post.id} to={`/forum/post/${post.id}`} className="forum-follow-card">
                <div className="forum-follow-card-topline">
                  <span className="forum-tag">{getSectionLabel(post.section)}</span>
                  <span className="muted">{formatTime(post.createdAt)}</span>
                </div>
                <strong>{post.title}</strong>
                <p className="muted mb-0">{getPreview(post.content)}</p>
                <span className="forum-follow-meta">
                  {post.authorName}
                  {post.forum?.name ? ` · ${post.forum.name}` : ''}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
