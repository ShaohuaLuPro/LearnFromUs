import React, { useState } from 'react';
import { getSectionLabel } from '../lib/sections';

export default function ForumRequestReviewPage({
  forumWorkspace,
  onApproveForumRequest,
  onRejectForumRequest
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pendingRequests = forumWorkspace?.pendingRequests || [];

  const approveRequest = async (requestId) => {
    setMessage('');
    setError('');
    const result = await onApproveForumRequest(requestId);
    if (!result.ok) {
      setError(result.message || 'Failed to approve space request.');
      return;
    }
    setMessage(result.message || 'Space request approved.');
  };

  const rejectRequest = async (requestId) => {
    setMessage('');
    setError('');
    const result = await onRejectForumRequest(requestId);
    if (!result.ok) {
      setError(result.message || 'Failed to reject space request.');
      return;
    }
    setMessage(result.message || 'Space request rejected.');
  };

  return (
    <div className="container page-shell">
      <section className="panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
          <div>
            <p className="type-kicker mb-2">Admin</p>
            <h2 className="mb-1 type-title-md">Space Request Reviews</h2>
            <p className="type-body mb-0">
              Review pending space creation requests and decide whether to approve or reject them.
            </p>
          </div>
        </div>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-4`}>
            {error || message}
          </div>
        )}

        {pendingRequests.length ? (
          <div className="forum-follow-list">
            {pendingRequests.map((request) => (
              <article key={request.id} className="forum-follow-card">
                <strong>{request.name}</strong>
                <p className="muted mb-2">{request.description}</p>
                <p className="muted mb-2">{request.rationale}</p>
                {request.reviewNote && (
                  <p className="muted mb-2">Last rejection note: {request.reviewNote}</p>
                )}
                <span className="forum-follow-meta">
                  {request.requesterName} / {request.sectionScope.map(getSectionLabel).join(', ')}
                </span>
                <div className="d-flex gap-2 flex-wrap mt-3">
                  <button type="button" className="forum-primary-btn" onClick={() => approveRequest(request.id)}>
                    Approve
                  </button>
                  <button type="button" className="forum-danger-btn" onClick={() => rejectRequest(request.id)}>
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="settings-card">
            <h4 className="mb-2">No pending requests</h4>
            <p className="muted mb-0">There are no space creation requests waiting for review right now.</p>
          </section>
        )}
      </section>
    </div>
  );
}
