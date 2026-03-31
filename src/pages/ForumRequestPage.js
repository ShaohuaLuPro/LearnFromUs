import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getSectionLabel } from '../lib/sections';

const AI_REWRITE_PRESETS = [
  {
    id: 'polish',
    label: 'Polish',
    instruction: 'Polish this forum request for clarity and flow while preserving the original idea.'
  },
  {
    id: 'narrow',
    label: 'More Focused',
    instruction: 'Make this forum request more focused and specific, with a clearer target audience and tighter section scope.'
  },
  {
    id: 'expand',
    label: 'More Detailed',
    instruction: 'Expand this forum request with clearer examples of what belongs in the forum and why members would use it.'
  },
  {
    id: 'stronger',
    label: 'Stronger Pitch',
    instruction: 'Strengthen the rationale so it makes a more convincing case for why this forum should exist.'
  }
];

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

export default function ForumRequestPage({
  currentUser,
  onRequestForum,
  onAiRewriteForumRequest
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [rewriteAbortController, setRewriteAbortController] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    rationale: '',
    sectionScope: []
  });
  const [sectionScopeText, setSectionScopeText] = useState('');
  const [scopeRecommendations, setScopeRecommendations] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [aiRewriteOpen, setAiRewriteOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiRewriteMessage, setAiRewriteMessage] = useState('');
  const [aiRewriteLoading, setAiRewriteLoading] = useState(false);

  useEffect(() => () => {
    rewriteAbortController?.abort();
  }, [rewriteAbortController]);

  const syncSectionScope = useCallback((nextScope) => {
    const normalizedScope = normalizeScopeList(nextScope);
    setForm((current) => ({
      ...current,
      sectionScope: normalizedScope
    }));
    setSectionScopeText(toScopeText(normalizedScope));
    return normalizedScope;
  }, []);

  const applyDraft = useCallback((draft, nextMessage = '') => {
    const normalizedScope = normalizeScopeList(draft?.sectionScope);
    setForm({
      name: String(draft?.name || ''),
      description: String(draft?.description || ''),
      rationale: String(draft?.rationale || ''),
      sectionScope: normalizedScope
    });
    setSectionScopeText(toScopeText(normalizedScope));
    setScopeRecommendations(normalizedScope);
    setMessage(nextMessage);
    setError('');
  }, []);

  useEffect(() => {
    const draft = location.state?.forumRequestDraft;
    if (!draft) {
      return;
    }

    applyDraft(draft, 'AI draft loaded. Review it, edit the section scope if needed, then submit when ready.');
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null
    });
  }, [applyDraft, location.pathname, location.search, location.state, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (normalizeScopeList(form.sectionScope).length === 0) {
      setError('Add at least one section scope for this forum.');
      return;
    }

    const result = await onRequestForum({
      ...form,
      sectionScope: normalizeScopeList(form.sectionScope)
    });
    if (!result.ok) {
      setError(result.message || 'Failed to request forum.');
      return;
    }

    setForm({
      name: '',
      description: '',
      rationale: '',
      sectionScope: []
    });
    setSectionScopeText('');
    setScopeRecommendations([]);
    setAiRewriteOpen(false);
    setAiRewriteMessage('');
    setAiInstruction('');
    setMessage(result.message || 'Forum request submitted.');
  };

  const runAiRewrite = async (instructionOverride) => {
    const instruction = String(instructionOverride || aiInstruction).trim();
    if (!instruction) {
      setError('Add a rewrite instruction first.');
      return;
    }

    if (!String(form.name || form.description || form.rationale || sectionScopeText).trim()) {
      setError('Add a rough forum idea first so AI has something to rewrite.');
      return;
    }

    setError('');
    setMessage('');
    setAiRewriteMessage('');
    setAiRewriteLoading(true);
    const controller = new AbortController();
    setRewriteAbortController(controller);
    const result = await onAiRewriteForumRequest({
      instruction,
      draft: {
        name: form.name,
        description: form.description,
        rationale: form.rationale,
        sectionScope: normalizeScopeList(form.sectionScope)
      }
    }, controller.signal);
    setRewriteAbortController(null);
    setAiRewriteLoading(false);

    if (!result.ok) {
      if (result.message === 'Request cancelled.') {
        setAiRewriteMessage('AI rewrite stopped.');
        return;
      }
      setError(result.message || 'Failed to rewrite forum request with AI.');
      return;
    }

    const rewrittenDraft = result.data?.draft;
    if (!rewrittenDraft) {
      setError('AI rewrite did not return a draft.');
      return;
    }

    applyDraft(rewrittenDraft);
    setAiRewriteMessage(result.data?.generation?.rationale || 'AI rewrite applied to the editor. Review it, then submit when you are ready.');
  };

  const stopAiRewrite = () => {
    rewriteAbortController?.abort();
    setRewriteAbortController(null);
    setAiRewriteLoading(false);
  };

  const removeScope = (value) => {
    const nextScope = form.sectionScope.filter((item) => item !== value);
    syncSectionScope(nextScope);
  };

  const addRecommendedScope = (value) => {
    const nextScope = normalizeScopeList([...form.sectionScope, value]);
    syncSectionScope(nextScope);
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
          <div className="forum-actions">
            <Link to="/forums/request/history" className="forum-primary-btn text-decoration-none">
              Request History
            </Link>
            <Link to="/my-forums" className="forum-secondary-btn text-decoration-none">
              Back to My Forums
            </Link>
          </div>
        </div>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-4`}>
            {error || message}
          </div>
        )}

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
                Enter comma-separated scope labels. You can write your own, and AI can recommend a few.
              </div>
            </div>

            {scopeRecommendations.length > 0 && (
              <div className="mb-3">
                <label className="form-label">AI Recommendations</label>
                <div className="section-chip-wrap">
                  {scopeRecommendations.map((scope) => (
                    <button
                      key={`scope-recommendation-${scope}`}
                      type="button"
                      className={`section-chip ${form.sectionScope.includes(scope) ? 'is-active' : ''}`}
                      onClick={() => addRecommendedScope(scope)}
                    >
                      <span>{getSectionLabel(scope)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.sectionScope.length > 0 && (
              <div className="mb-3">
                <label className="form-label">Current Scope</label>
                <div className="section-chip-wrap">
                  {form.sectionScope.map((scope) => (
                    <button
                      key={`scope-current-${scope}`}
                      type="button"
                      className="section-chip is-active"
                      onClick={() => removeScope(scope)}
                    >
                      <span>{getSectionLabel(scope)}</span>
                    </button>
                  ))}
                </div>
                <div className="form-help">Click a chip to remove it.</div>
              </div>
            )}

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

            <div className="mb-3">
              <div className="composer-toolbar">
                <button
                  type="button"
                  className="forum-secondary-btn"
                  onClick={() => setAiRewriteOpen((current) => !current)}
                >
                  {aiRewriteOpen ? 'Hide AI Rewrite' : 'Open AI Rewrite'}
                </button>
              </div>
            </div>

            {aiRewriteOpen && (
              <section className="settings-card mb-3">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <div>
                    <h4 className="mb-1">AI Rewrite</h4>
                    <p className="muted mb-0">Use OpenAI to polish, narrow, expand, or strengthen this forum request draft.</p>
                  </div>
                  <span className="muted">Works on the current editor content</span>
                </div>

                <div className="forum-actions mb-3">
                  {AI_REWRITE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="forum-secondary-btn"
                      disabled={aiRewriteLoading}
                      onClick={() => {
                        setAiInstruction(preset.instruction);
                        runAiRewrite(preset.instruction);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <label className="form-label">Custom instruction</label>
                <textarea
                  className="form-control forum-input"
                  rows={3}
                  value={aiInstruction}
                  onChange={(event) => setAiInstruction(event.target.value)}
                  placeholder="Example: make the pitch tighter, keep the audience specific, and suggest sharper scope labels."
                />
                <div className="forum-actions mt-3">
                  {aiRewriteLoading && (
                    <button type="button" className="forum-secondary-btn" onClick={stopAiRewrite}>
                      Stop
                    </button>
                  )}
                  <button
                    type="button"
                    className="forum-primary-btn"
                    disabled={aiRewriteLoading}
                    onClick={() => runAiRewrite()}
                  >
                    {aiRewriteLoading ? 'Rewriting...' : 'Rewrite with AI'}
                  </button>
                </div>
                {aiRewriteMessage && <p className="muted mt-3 mb-0">{aiRewriteMessage}</p>}
              </section>
            )}

            <button type="submit" className="forum-primary-btn mt-4">
              Submit Request
            </button>
          </form>
        </section>

      </section>
    </div>
  );
}
