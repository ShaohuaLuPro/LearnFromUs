import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { apiGetForumFollowers } from '../api';
import { authStorage } from '../lib/authStorage';

function formatTime(timestamp) {
  if (!timestamp) {
    return 'Recently followed';
  }

  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function ForumFollowersPage({ currentUser, forums = [] }) {
  const { forumSlug } = useParams();
  const [followers, setFollowers] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const selectedForum = useMemo(
    () => forums.find((forum) => forum.slug === String(forumSlug || '').trim().toLowerCase()) || null,
    [forums, forumSlug]
  );

  const canViewFollowers = Boolean(
    currentUser && selectedForum && (
      currentUser.isAdmin
      || selectedForum.ownerId === currentUser.id
      || (selectedForum.currentUserPermissions || []).includes('view_followers')
    )
  );

  useEffect(() => {
    let cancelled = false;

    async function loadFollowers() {
      if (!selectedForum?.id || !canViewFollowers) {
        setFollowers([]);
        setLoading(false);
        return;
      }

      const token = authStorage.getToken();
      if (!token) {
        setMessage('Please login first.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage('');
      try {
        const data = await apiGetForumFollowers(selectedForum.id, token);
        if (!cancelled) {
          setFollowers(data.followers || []);
        }
      } catch (error) {
        if (!cancelled) {
          setFollowers([]);
          setMessage(error instanceof Error ? error.message : 'Failed to load space followers.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadFollowers();
    return () => {
      cancelled = true;
    };
  }, [canViewFollowers, selectedForum?.id]);

  if (forums.length > 0 && !selectedForum) {
    return <Navigate to="/forum" replace />;
  }

  if (!canViewFollowers && selectedForum) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <p className="type-kicker mb-1">Space</p>
              <h2 className="mb-1 type-title-md">{selectedForum.name} Followers</h2>
              <p className="muted mb-0">Only the space owner, site admins, or managers with follower-view access can open this page.</p>
            </div>
            <Link to={`/forum/${selectedForum.slug}`} className="forum-secondary-btn text-decoration-none">
              Back to Space
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <section className="panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-1">Space</p>
            <h2 className="mb-1 type-title-md">{selectedForum?.name || 'Space'} Followers</h2>
            <p className="muted mb-0">Only the space owner, site admins, or managers with follower-view access can see who follows this space.</p>
          </div>
          {selectedForum && (
            <Link to={`/forum/${selectedForum.slug}`} className="forum-secondary-btn text-decoration-none">
              Back to Space
            </Link>
          )}
        </div>

        {selectedForum && (
          <div className="forum-post-kicker mb-3">
            <span className="forum-tag">{selectedForum.followerCount ?? followers.length} followers</span>
            <span className="forum-tag">{selectedForum.livePostCount ?? selectedForum.postCount ?? 0} posts</span>
          </div>
        )}

        {loading ? (
          <p className="muted mb-0">Loading followers...</p>
        ) : message ? (
          <div className="settings-alert is-error mb-0">{message}</div>
        ) : followers.length === 0 ? (
          <p className="muted mb-0">No one is following this space yet.</p>
        ) : (
          <div className="forum-follow-list">
            {followers.map((follower) => (
              <Link key={follower.id} to={`/users/${follower.id}`} className="forum-follow-card">
                <div className="forum-follow-card-topline">
                  <span className="forum-tag">Follower</span>
                  <span className="muted">{formatTime(follower.followedAt)}</span>
                </div>
                <strong>{follower.name}</strong>
                <span className="forum-follow-meta">Open profile</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
