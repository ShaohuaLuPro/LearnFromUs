import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  apiFollowUser,
  apiGetFollowing,
  apiUnfollowUser
} from '../api';
import { authStorage } from '../lib/authStorage';

function NetworkRow({ user, pending, onToggleFollow }) {
  return (
    <article className={`network-list-row ${user.isFollowing ? '' : 'is-inactive'}`}>
      <div className="network-list-copy">
        <div className="network-card-topline">
          <Link to={`/users/${user.id}`} className="network-user-link">
            <h5 className="mb-1">{user.name}</h5>
          </Link>
          {user.isFollowedBy && (
            <span className="network-relationship-pill">{user.isFollowing ? 'Mutual' : 'Follows you'}</span>
          )}
          {!user.isFollowing && (
            <span className="network-status-pill">Unfollowed</span>
          )}
        </div>
        <p className="muted mb-2">{user.bio || 'Technical builder sharing practical work.'}</p>
        <div className="following-user-stats">
          <span>{user.followerCount} followers</span>
          <span>{user.followingCount} following</span>
        </div>
      </div>
      <div className="network-card-actions">
        <button
          type="button"
          className={user.isFollowing ? 'forum-secondary-btn' : 'forum-primary-btn'}
          onClick={() => onToggleFollow(user)}
          disabled={pending}
        >
          {pending ? 'Updating...' : user.isFollowing ? 'Unfollow' : 'Refollow'}
        </button>
      </div>
    </article>
  );
}

function ForumRow({ forum }) {
  return (
    <article className="network-list-row">
      <div className="network-list-copy">
        <div className="network-card-topline">
          <Link to={`/forum/${forum.slug}`} className="network-user-link">
            <h5 className="mb-1">{forum.name}</h5>
          </Link>
          <span className="network-relationship-pill">{forum.isCore ? 'Core Forum' : 'Community Forum'}</span>
        </div>
        <p className="muted mb-2">{forum.description || 'A forum you follow for quick access.'}</p>
        <div className="following-user-stats">
          <span>{forum.followerCount ?? 0} followers</span>
          <span>{forum.livePostCount ?? forum.postCount ?? 0} posts</span>
          <span>{(forum.sectionScope || []).length} sections</span>
        </div>
      </div>
      <div className="network-card-actions">
        <Link to={`/forum/${forum.slug}`} className="forum-primary-btn text-decoration-none">
          Open Forum
        </Link>
      </div>
    </article>
  );
}

export default function Following({ forums = [] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState('');
  const followedForums = useMemo(() => forums.filter((forum) => forum.isFollowing), [forums]);

  const activeTab = (() => {
    const tab = searchParams.get('tab');
    if (tab === 'followers' || tab === 'forums') {
      return tab;
    }
    return 'following';
  })();

  useEffect(() => {
    let cancelled = false;

    async function loadNetwork() {
      setLoading(true);
      setMessage('');
      try {
        const token = authStorage.getToken();
        const data = await apiGetFollowing(token);
        if (!cancelled) {
          setFollowers(data.followers || []);
          setFollowing(data.following || data.users || []);
        }
      } catch (error) {
        if (!cancelled) {
          setFollowers([]);
          setFollowing([]);
          setMessage(error.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadNetwork();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentList = useMemo(() => {
    if (activeTab === 'followers') {
      return followers;
    }
    if (activeTab === 'forums') {
      return followedForums;
    }
    return following;
  }, [activeTab, followers, followedForums, following]);

  const currentCount = currentList.length;

  const setTab = (tab) => {
    setSearchParams({ tab });
    setMessage('');
  };

  const patchUserAcrossLists = (userId, nextIsFollowing) => {
    let updatedUser = null;

    setFollowers((current) => current.map((item) => {
      if (item.id !== userId) {
        return item;
      }
      updatedUser = { ...item, isFollowing: nextIsFollowing };
      return updatedUser;
    }));

    setFollowing((current) => {
      let found = false;
      const nextItems = current.map((item) => {
        if (item.id !== userId) {
          return item;
        }
        found = true;
        return { ...item, isFollowing: nextIsFollowing };
      });

      if (!found && nextIsFollowing && updatedUser) {
        return [...nextItems, updatedUser];
      }

      return nextItems;
    });
  };

  const toggleFollow = async (user) => {
    const token = authStorage.getToken();
    if (!token) {
      setMessage('Please login first.');
      return;
    }

    setPendingUserId(user.id);
    try {
      if (user.isFollowing) {
        await apiUnfollowUser(user.id, token);
        patchUserAcrossLists(user.id, false);
      } else {
        await apiFollowUser(user.id, token);
        patchUserAcrossLists(user.id, true);
      }
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPendingUserId('');
    }
  };

  if (loading) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <p className="muted mb-0">Loading your network...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <section className="panel network-shell">
        <div className="network-layout">
          <aside className="network-sidebar">
            <p className="type-kicker mb-2">Network</p>
            <h2 className="mb-3 type-title-md">Manage Connections</h2>
            <div className="network-sidebar-nav">
              <button
                type="button"
                className={`network-sidebar-link ${activeTab === 'following' ? 'is-active' : ''}`}
                onClick={() => setTab('following')}
              >
                <span>Following</span>
                <strong>{following.length}</strong>
              </button>
              <button
                type="button"
                className={`network-sidebar-link ${activeTab === 'followers' ? 'is-active' : ''}`}
                onClick={() => setTab('followers')}
              >
                <span>Followers</span>
                <strong>{followers.length}</strong>
              </button>
              <button
                type="button"
                className={`network-sidebar-link ${activeTab === 'forums' ? 'is-active' : ''}`}
                onClick={() => setTab('forums')}
              >
                <span>Forums</span>
                <strong>{followedForums.length}</strong>
              </button>
            </div>
            <Link to="/forum" className="forum-secondary-btn text-decoration-none network-back-link">
              Back to Forum
            </Link>
          </aside>

          <div className="network-content">
            <div className="network-content-head">
              <div>
                <h3 className="mb-1 type-title-md">
                  {activeTab === 'followers' ? 'Followers' : activeTab === 'forums' ? 'Followed Forums' : 'Following'}
                </h3>
                <p className="type-body mb-0">
                  {activeTab === 'followers'
                    ? 'See who is following you.'
                    : activeTab === 'forums'
                      ? 'Open any forum you follow without going back through search.'
                      : 'Unfollow now, and refollow before refresh if you change your mind.'}
                </p>
              </div>
              <span className="network-count-badge">{currentCount}</span>
            </div>

            {message && <div className="settings-alert is-error mb-3">{message}</div>}

            <div className="network-list">
              {activeTab === 'forums'
                ? currentList.map((forum) => (
                    <ForumRow key={`forum-${forum.id}`} forum={forum} />
                  ))
                : currentList.map((user) => (
                    <NetworkRow
                      key={`${activeTab}-${user.id}`}
                      user={user}
                      pending={pendingUserId === user.id}
                      onToggleFollow={toggleFollow}
                    />
                  ))}
            </div>

            {currentList.length === 0 && !message && (
              <section className="settings-card">
                <h4 className="mb-2">
                  {activeTab === 'followers'
                    ? 'No followers yet'
                    : activeTab === 'forums'
                      ? 'No followed forums yet'
                      : 'You are not following anyone'}
                </h4>
                <p className="muted mb-0">
                  {activeTab === 'followers'
                    ? 'When other users follow you, they will appear here.'
                    : activeTab === 'forums'
                      ? 'Once you follow forums, they will appear here for quick access.'
                      : 'Once you follow someone, they will appear here for quick management.'}
                </p>
              </section>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
