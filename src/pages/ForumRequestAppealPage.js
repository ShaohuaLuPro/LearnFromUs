import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSectionLabel } from '../lib/sections';

function normalizeScopeValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function normalizeScopeList(input) {
  const raw = Array.isArray(input)
    ? input
    : String(input || '')
      .split(/[\n,]/)
      .map((value) => value.trim());

  return [...new Set(raw.map((value) => normalizeScopeValue(value)).filter(Boolean))].slice(0, 12);
}

function toScopeText(sectionScope) {
  return normalizeScopeList(sectionScope).join(', ');
}

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

export default function ForumRequestAppealPage({
  forumWorkspace,
  loadingWorkspace,
  onAppealForumRequest
}) {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const request = useMemo(
    () => (forumWorkspace?.myRequests || []).find((item) => item.id === requestId) || null,
    [forumWorkspace, requestId]
  );

  const [form, setForm] = useState({
    name: '',
    description: '',
    rationale: '',
    sectionScope: [],
    appealNote: ''
  });
  const [sectionScopeText, setSectionScopeText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!request) {
      return;
    }

    const normalizedScope = normalizeScopeList(request.sectionScope || []);
    setForm({
      name: request.name || '',
      description: request.description || '',
      rationale: request.rationale || '',
      sectionScope: normalizedScope,
      appealNote: ''
    });
    setSectionScopeText(toScopeText(normalizedScope));
  }, [request]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!request) {
      setError('This forum request could not be found.');
      return;
    }

    const normalizedScope = normalizeScopeList(form.sectionScope);
    if (normalizedScope.length === 0) {
      setError('Add at least one section scope before submitting the appeal.');
      return;
    }
    if (!String(form.appealNote || '').trim()) {
      setError('Explain what changed and why this request should be reviewed again.');
      return;
    }

    setSubmitting(true);
    const result = await onAppealForumRequest(request.id, {
      name: form.name,
      description: form.description,
      rationale: form.rationale,
      sectionScope: normalizedScope,
      slug: request.slug,
      appealNote: form.appealNote
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message || 'Failed to submit appeal.');
      return;
    }

    navigate('/forums/request/history', {
      replace: true,
      state: {
        message: result.message || 'Appeal submitted. Your forum request is back in the review queue.'
      }
    });
  };

  if (loadingWorkspace && !request) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <section className="settings-card">
            <h4 className="mb-2">Loading request...</h4>
            <p className="muted mb-0">We are loading the latest rejection details for this appeal.</p>
          </section>
        </section>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <section className="settings-card">
            <h4 className="mb-2">Request not found</h4>
            <p className="muted mb-3">This forum request is not available in your request history.</p>
            <Link to="/forums/request/history" className="forum-primary-btn text-decoration-none">
              Back to Request History
            </Link>
          </section>
        </section>
      </div>
    );
  }

  if (request.status !== 'rejected') {
    return (
      <div className="container page-shell">
        <section className="panel">
          <section className="settings-card">
            <h4 className="mb-2">Appeal unavailable</h4>
            <p className="muted mb-3">Only rejected forum requests can be appealed from this page.</p>
            <Link to="/forums/request/history" className="forum-primary-btn text-decoration-none">
              Back to Request History
            </Link>
          </section>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <section className="panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
          <div>
            <p className="type-kicker mb-2">Forum</p>
            <h2 className="mb-1 type-title-md">Appeal Forum Rejection</h2>
            <p className="type-body mb-0">
              Revise the request, explain what changed, and send it back for another review.
            </p>
          </div>
          <div className="forum-actions">
            <Link to="/forums/request/history" className="forum-primary-btn text-decoration-none">
              Request History
            </Link>
            <Link to="/my-forums" className="forum-secondary-btn text-decoration-none">
              Back to My Forums
            </Link>
          </div>
        </div>

        {error && (
          <div className="settings-alert is-error mb-4">
            {error}
          </div>
        )}

        <section className="settings-card mb-4">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <h3 className="mb-0 type-title-md">Last Review</h3>
            <span className="forum-tag">Rejected</span>
          </div>
          <p className="muted mb-2">
            Submitted {formatDate(request.createdAt)}
            {request.reviewedAt ? ` | Reviewed ${formatDate(request.reviewedAt)}` : ''}
          </p>
          <p className="muted mb-2">{request.reviewNote || 'No rejection note was left on this request.'}</p>
          <div className="section-chip-wrap">
            {(request.sectionScope || []).map((scope) => (
              <span key={`request-scope-${scope}`} className="section-chip is-active">
                <span>{getSectionLabel(scope)}</span>
              </span>
            ))}
          </div>
        </section>

        <section className="section-card is-open">
          <h3 className="mb-3 type-title-md">Appeal Draft</h3>

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
                placeholder="Clarify what kind of discussion should live in this forum."
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Section Scope</label>
              <textarea
                className="form-control forum-input"
                rows={2}
                value={sectionScopeText}
                onChange={(event) => {
                  const nextText = event.target.value;
                  setSectionScopeText(nextText);
                  setForm((current) => ({
                    ...current,
                    sectionScope: normalizeScopeList(nextText)
                  }));
                }}
                onBlur={() => setSectionScopeText(toScopeText(form.sectionScope))}
                placeholder="Example: mlops-platforms, model-deployment, evaluation-and-monitoring"
              />
              <div className="form-help">
                Use comma-separated scope labels. Narrower scope usually makes review easier.
              </div>
            </div>

            {form.sectionScope.length > 0 && (
              <div className="mb-3">
                <label className="form-label">Current Scope</label>
                <div className="section-chip-wrap">
                  {form.sectionScope.map((scope) => (
                    <span key={`current-scope-${scope}`} className="section-chip is-active">
                      <span>{getSectionLabel(scope)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label">Why Should This Forum Exist?</label>
              <textarea
                className="form-control forum-input"
                rows={4}
                value={form.rationale}
                onChange={(event) => setForm((current) => ({ ...current, rationale: event.target.value }))}
                placeholder="Describe the audience, the need, and how this forum would help."
              />
            </div>

            <div className="mb-2">
              <label className="form-label">Why Should This Rejection Be Reconsidered?</label>
              <textarea
                className="form-control forum-input"
                rows={4}
                value={form.appealNote}
                onChange={(event) => setForm((current) => ({ ...current, appealNote: event.target.value }))}
                placeholder="Explain what you changed, how you addressed the review note, and why this request should be reviewed again."
              />
              <div className="form-help">
                This note is attached to the resubmitted request so the next reviewer can see what changed.
              </div>
            </div>

            <button type="submit" className="forum-primary-btn mt-4" disabled={submitting}>
              {submitting ? 'Submitting Appeal...' : 'Submit Appeal'}
            </button>
          </form>
        </section>
      </section>
    </div>
  );
}
