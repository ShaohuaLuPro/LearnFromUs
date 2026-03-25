import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDefaultSectionValue, getSectionLabel, getSectionOptions } from '../lib/sections';

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

export default function ForumRequestPage({
  currentUser,
  forums,
  forumWorkspace,
  onRequestForum,
  onApproveForumRequest,
  onRejectForumRequest
}) {
  const availableSections = useMemo(() => getSectionOptions(forums), [forums]);
  const defaultSectionValue = useMemo(() => getDefaultSectionValue(forums), [forums]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    rationale: '',
    sectionScope: [defaultSectionValue]
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setForm((current) => {
      if (current.sectionScope.length > 0) {
        return current;
      }

      return {
        ...current,
        sectionScope: [defaultSectionValue]
      };
    });
  }, [defaultSectionValue]);

  const toggleSection = (sectionValue) => {
    setForm((current) => ({
      ...current,
      sectionScope: current.sectionScope.includes(sectionValue)
        ? current.sectionScope.filter((value) => value !== sectionValue)
        : [...current.sectionScope, sectionValue].slice(0, 4)
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const result = await onRequestForum(form);
    if (!result.ok) {
      setError(result.message || 'Failed to request forum.');
      return;
    }

    setForm({
      name: '',
      description: '',
      rationale: '',
      sectionScope: [defaultSectionValue]
    });
    setMessage(result.message || 'Forum request submitted.');
  };

  const approveRequest = async (requestId) => {
    setMessage('');
    setError('');
    const result = await onApproveForumRequest(requestId);
    if (!result.ok) {
      setError(result.message || 'Failed to approve forum request.');
      return;
    }
    setMessage(result.message || 'Forum request approved.');
  };

  const rejectRequest = async (requestId) => {
    setMessage('');
    setError('');
    const result = await onRejectForumRequest(requestId);
    if (!result.ok) {
      setError(result.message || 'Failed to reject forum request.');
      return;
    }
    setMessage(result.message || 'Forum request rejected.');
  };

  return (
    <div className="container page-shell">
      <section className="panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
          <div>
            <p className="type-kicker mb-2">Forum</p>
            <h2 className="mb-1 type-title-md">Request A New Forum</h2>
            <p className="type-body mb-0">
              Propose a new community space, define its topic scope, and track review status.
            </p>
          </div>
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">
            Back to Forum
          </Link>
        </div>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-4`}>
            {error || message}
          </div>
        )}

        <div className="section-grid">
          <section className="section-card is-open">
            <h3 className="mb-3 type-title-md">Application</h3>
            <form onSubmit={submit} className="forum-form">
              <div className="mb-3">
                <label className="form-label">Forum Name</label>
                <input
                  className="form-control forum-input"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Career Growth, MLOps Guild, Frontend Patterns"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control forum-input"
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="What kind of discussion should live in this forum?"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Section Scope</label>
                <div className="section-chip-wrap">
                  {availableSections.map((item) => (
                    <button
                      key={`forum-request-${item.value}`}
                      type="button"
                      className={`section-chip ${form.sectionScope.includes(item.value) ? 'is-active' : ''}`}
                      onClick={() => toggleSection(item.value)}
                    >
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
                <div className="form-help">Choose up to 4 sections that belong in this forum.</div>
              </div>

              <div className="mb-2">
                <label className="form-label">Why Should This Forum Exist?</label>
                <textarea
                  className="form-control forum-input"
                  rows={4}
                  value={form.rationale}
                  onChange={(event) => setForm((current) => ({ ...current, rationale: event.target.value }))}
                  placeholder="Describe the audience, the need, and how this forum would help."
                />
              </div>

              <button type="submit" className="forum-primary-btn mt-4">
                Submit Request
              </button>
            </form>
          </section>

          <section className="section-card is-open">
            <h3 className="mb-3 type-title-md">Your Requests</h3>
            {forumWorkspace?.myRequests?.length ? (
              <div className="forum-follow-list">
                {forumWorkspace.myRequests.map((request) => (
                  <article key={request.id} className="forum-follow-card">
                    <strong>{request.name}</strong>
                    <p className="muted mb-2">{request.description}</p>
                    <span className="forum-follow-meta">
                      {request.status} · {request.sectionScope.map(getSectionLabel).join(', ')}
                    </span>
                    {request.reviewNote && (
                      <p className="muted mb-0">Review note: {request.reviewNote}</p>
                    )}
                    {request.reviewedAt && (
                      <p className="muted mb-0">Reviewed {formatDate(request.reviewedAt)}</p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted mb-0">You have not submitted any forum requests yet.</p>
            )}
          </section>
        </div>

        {currentUser?.isAdmin && (
          <section className="panel mt-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <div>
                <p className="type-kicker mb-2">Admin</p>
                <h3 className="mb-1 type-title-md">Pending Reviews</h3>
              </div>
            </div>

            {forumWorkspace?.pendingRequests?.length ? (
              <div className="forum-follow-list">
                {forumWorkspace.pendingRequests.map((request) => (
                  <article key={request.id} className="forum-follow-card">
                    <strong>{request.name}</strong>
                    <p className="muted mb-2">{request.description}</p>
                    <p className="muted mb-2">{request.rationale}</p>
                    <span className="forum-follow-meta">
                      {request.requesterName} · {request.sectionScope.map(getSectionLabel).join(', ')}
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
              <p className="muted mb-0">There are no pending forum requests right now.</p>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
