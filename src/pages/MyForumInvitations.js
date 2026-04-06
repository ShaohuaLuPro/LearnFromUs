import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiAcceptForumManagerInvite,
  apiGetForumManagerInvites,
  apiRejectForumManagerInvite
} from '../api';
import { authStorage } from '../lib/authStorage';

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return 'Just now';
  }

  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const FORUM_PERMISSION_LABELS = {
  manage_admins: 'Manage Admins',
  manage_sections: 'Manage Sections',
  view_followers: 'View Followers',
  moderate_posts: 'Delete Posts',
  review_appeals: 'Review Appeals',
  publish_announcements: 'Publish Announcements'
};

export default function MyForumInvitations({ onLoadForums }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadInvites() {
      const token = authStorage.getToken();
      if (!token) {
        if (!cancelled) {
          setLoading(false);
          setError('Please login first.');
        }
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await apiGetForumManagerInvites(token);
        if (!cancelled) {
          setInvites(data.invites || []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load space manager invites.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInvites();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAcceptInvite = async (inviteId) => {
    setActionKey(`accept-${inviteId}`);
    setMessage('');
    setError('');
    try {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiAcceptForumManagerInvite(inviteId, token);
      setInvites((current) => current.filter((invite) => invite.id !== inviteId));
      await onLoadForums?.();
      setMessage(response.message || 'Space manager invite accepted.');
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Failed to accept space manager invite.');
    } finally {
      setActionKey('');
    }
  };

  const handleRejectInvite = async (inviteId) => {
    setActionKey(`reject-${inviteId}`);
    setMessage('');
    setError('');
    try {
      const token = authStorage.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }

      const response = await apiRejectForumManagerInvite(inviteId, token);
      setInvites((current) => current.filter((invite) => invite.id !== inviteId));
      setMessage(response.message || 'Space manager invite declined.');
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Failed to decline space manager invite.');
    } finally {
      setActionKey('');
    }
  };

  return (
    <div className="container page-shell my-forums-page">
      <section className="panel my-forums-panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-1">Workspace</p>
            <h2 className="mb-1 type-title-md">Manager Invitations</h2>
            <p className="muted mb-0">Review pending space manager invites here, then accept or decline them.</p>
          </div>
          <Link to="/my-forums" className="forum-secondary-btn text-decoration-none">
            Back to My Spaces
          </Link>
        </div>

        {error && <div className="settings-alert is-error mb-3">{error}</div>}
        {message && <div className="settings-alert is-success mb-3">{message}</div>}

        <section className="settings-card forum-admin-panel">
          <div className="forum-admin-panel-head">
            <div>
              <h5 className="mb-1">Pending Invitations</h5>
              <p className="muted mb-0">Each accepted invite will add that space to your `My Spaces` list.</p>
            </div>
            <span className="muted">{invites.length} pending</span>
          </div>

          {loading ? (
            <p className="muted mb-0">Loading invitations...</p>
          ) : invites.length === 0 ? (
            <p className="muted mb-0">No pending space manager invites right now.</p>
          ) : (
            <div className="forum-admin-manager-list">
              {invites.map((invite) => (
                <article key={invite.id} className="forum-admin-manager-card">
                  <div className="forum-admin-manager-head">
                    <div>
                      <strong>{invite.forumName}</strong>
                      <p className="muted mb-0">
                        Invited by {invite.invitedByName || 'Unknown user'} on {formatTimestamp(invite.createdAt)}
                      </p>
                    </div>
                    <div className="forum-actions">
                      <button
                        type="button"
                        className="forum-primary-btn"
                        onClick={() => handleAcceptInvite(invite.id)}
                        disabled={actionKey === `accept-${invite.id}` || actionKey === `reject-${invite.id}`}
                      >
                        {actionKey === `accept-${invite.id}` ? 'Accepting...' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        className="forum-secondary-btn"
                        onClick={() => handleRejectInvite(invite.id)}
                        disabled={actionKey === `accept-${invite.id}` || actionKey === `reject-${invite.id}`}
                      >
                        {actionKey === `reject-${invite.id}` ? 'Declining...' : 'Decline'}
                      </button>
                    </div>
                  </div>
                  <p className="muted mb-2">{invite.forumDescription || 'This space invited you to help manage it.'}</p>
                  <div className="section-chip-wrap">
                    {(invite.permissions || []).map((permission) => (
                      <span key={permission} className="section-chip is-active">
                        {FORUM_PERMISSION_LABELS[permission] || permission}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
