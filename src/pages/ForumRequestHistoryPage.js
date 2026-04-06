import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getSectionLabel } from '../lib/sections';

function formatDate(timestamp) {
  if (!timestamp) {
    return '';
  }

  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function ForumRequestHistoryPage({ forumWorkspace }) {
  const location = useLocation();
  const myRequests = forumWorkspace?.myRequests || [];
  const message = location.state?.message || '';

  return (
    <div className="container page-shell">
      <section className="panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
          <div>
            <p className="type-kicker mb-2">Space</p>
            <h2 className="mb-1 type-title-md">Your Requests</h2>
            <p className="type-body mb-0">
              Review every space request you have submitted and track its status.
            </p>
          </div>
          <div className="forum-actions">
            <Link to="/forums/request" className="forum-primary-btn text-decoration-none">
              New Request
            </Link>
            <Link to="/my-forums" className="forum-secondary-btn text-decoration-none">
              Back to My Spaces
            </Link>
          </div>
        </div>

        {message && (
          <div className="settings-alert is-success mb-4">
            {message}
          </div>
        )}

        {myRequests.length ? (
          <div className="forum-follow-list">
            {myRequests.map((request) => (
              <article key={request.id} className="forum-follow-card">
                <div className="forum-follow-card-topline">
                  <span className="forum-tag">
                    {request.status === 'pending' && request.reviewNote ? 'appeal pending' : request.status}
                  </span>
                  <span className="muted">{formatDate(request.createdAt)}</span>
                </div>
                <strong>{request.name}</strong>
                <p className="muted mb-2">{request.description || 'No description provided.'}</p>
                <span className="forum-follow-meta">
                  {request.sectionScope.map(getSectionLabel).join(', ') || 'No section scope'}
                </span>
                <p className="muted mb-0">{request.rationale || 'No rationale provided.'}</p>
                {request.reviewNote && (
                  <p className="muted mb-0">
                    {request.status === 'pending' ? 'Last review note: ' : 'Review note: '}
                    {request.reviewNote}
                  </p>
                )}
                {request.reviewedAt && (
                  <p className="muted mb-0">Reviewed {formatDate(request.reviewedAt)}</p>
                )}
                <div className="forum-actions">
                  {request.status === 'rejected' && (
                    <Link to={`/forums/request/${request.id}/appeal`} className="forum-primary-btn text-decoration-none">
                      Appeal
                    </Link>
                  )}
                  {request.status === 'approved' && request.forumSlug && (
                    <Link to={`/forum/${request.forumSlug}`} className="forum-secondary-btn text-decoration-none">
                      Open Space
                    </Link>
                  )}
                </div>
                {request.status === 'pending' && request.reviewNote && (
                  <p className="muted mb-0">This request was resubmitted after rejection and is waiting for another review.</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <section className="settings-card">
            <h4 className="mb-2">No requests yet</h4>
            <p className="muted mb-3">Once you submit a space request, the history will show up here.</p>
            <Link to="/forums/request" className="forum-primary-btn text-decoration-none">
              Create Request
            </Link>
          </section>
        )}
      </section>
    </div>
  );
}
