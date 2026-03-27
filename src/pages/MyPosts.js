import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import MarkdownBlock from '../components/MarkdownBlock';
import Select from '../components/Select';
import {
  getDefaultSectionValue,
  getSectionLabel,
  getSectionSelectOptions
} from '../lib/sections';

const codeLanguages = ['javascript', 'typescript', 'python', 'sql', 'bash', 'json'];
const codeLanguageOptions = codeLanguages.map((language) => ({
  value: language,
  label: language
}));

const AI_REWRITE_PRESETS = [
  {
    id: 'polish',
    label: 'Polish',
    instruction: 'Polish this post for clarity and flow while preserving my original meaning and voice.'
  },
  {
    id: 'shorter',
    label: 'Shorter',
    instruction: 'Make this post shorter and tighter while keeping the key ideas and examples.'
  },
  {
    id: 'expand',
    label: 'More Detailed',
    instruction: 'Expand this post with more explanation, smoother transitions, and one or two concrete examples.'
  },
  {
    id: 'formal',
    label: 'More Formal',
    instruction: 'Rewrite this post in a more formal, professional tone without making it stiff.'
  }
];

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getAppealDeadline(moderation) {
  if (!moderation?.deletedAt) {
    return null;
  }
  return moderation.deletedAt + 15 * 24 * 60 * 60 * 1000;
}

function hasExpandablePreview(content) {
  const text = String(content || '').trim();
  const nonEmptyLines = text.split(/\r?\n/).filter((line) => line.trim()).length;
  return text.length > 260 || nonEmptyLines > 4;
}

export default function MyPosts({
  currentUser,
  forums,
  onUpdatePost,
  onAiRewritePost,
  onDeletePost,
  onAppealPost,
  onGetMyPosts
}) {
  const location = useLocation();
  const fallbackSectionValue = useMemo(() => getDefaultSectionValue(forums), [forums]);
  const [rewriteAbortController, setRewriteAbortController] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', content: '', section: fallbackSectionValue, tags: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('javascript');
  const [myPosts, setMyPosts] = useState([]);
  const [appealNotes, setAppealNotes] = useState({});
  const [aiRewriteOpen, setAiRewriteOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiRewriteMessage, setAiRewriteMessage] = useState('');
  const [aiRewriteLoading, setAiRewriteLoading] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState({});
  const [showPreview, setShowPreview] = useState(false);

  const loadPosts = async () => {
    const result = await onGetMyPosts();
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMyPosts((result.posts || []).sort((a, b) => b.createdAt - a.createdAt));
  };

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    async function bootstrap() {
      const result = await onGetMyPosts();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMyPosts((result.posts || []).sort((a, b) => b.createdAt - a.createdAt));
    }
    bootstrap();
  }, [currentUser, onGetMyPosts]);

  const visiblePosts = useMemo(
    () => myPosts.filter((post) => post.authorId === currentUser?.id),
    [myPosts, currentUser]
  );

  const editingPost = useMemo(
    () => visiblePosts.find((post) => post.id === editingId) || null,
    [editingId, visiblePosts]
  );

  const editSectionOptions = useMemo(() => {
    const scopedSections = editingPost?.forum?.sectionScope;
    return getSectionSelectOptions(scopedSections?.length ? scopedSections : forums);
  }, [editingPost, forums]);

  const startEdit = (post, options = {}) => {
    rewriteAbortController?.abort();
    setRewriteAbortController(null);
    setEditingId(post.id);
    setEditForm({
      title: post.title,
      content: post.content,
      section: post.section || getDefaultSectionValue(post.forum?.sectionScope || [], forums),
      tags: (post.tags || []).join(', ')
    });
    setAiRewriteOpen(Boolean(options.openAiPanel));
    setAiInstruction('');
    setAiRewriteMessage('');
    setAiRewriteLoading(false);
    setShowPreview(false);
    setMessage('');
    setError('');
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetPostId = params.get('postId');
    const mode = params.get('mode');
    if (!targetPostId) {
      return;
    }
    const targetPost = visiblePosts.find((post) => post.id === targetPostId);
    if (!targetPost) {
      return;
    }
    if (editingId !== targetPostId) {
      startEdit(targetPost, { openAiPanel: mode === 'ai-rewrite' });
      return;
    }
    if (mode === 'ai-rewrite' && !aiRewriteOpen) {
      setAiRewriteOpen(true);
    }
  }, [location.search, visiblePosts, editingId, aiRewriteOpen]);

  const submitEdit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const result = await onUpdatePost(editingId, editForm);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEditingId(null);
    setShowPreview(false);
    setAiRewriteOpen(false);
    setAiRewriteMessage('');
    setMessage('Post updated.');
    await loadPosts();
  };

  const handleDelete = async (postId) => {
    setError('');
    setMessage('');
    const result = await onDeletePost(postId);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (editingId === postId) {
      setEditingId(null);
      setShowPreview(false);
      setAiRewriteOpen(false);
      setAiRewriteMessage('');
    }
    setMessage('Post deleted.');
    await loadPosts();
  };

  const handleAppeal = async (postId) => {
    setError('');
    setMessage('');
    const result = await onAppealPost(postId, appealNotes[postId] || '');
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message);
    await loadPosts();
  };

  const insertCodeTemplate = () => {
    const snippet = `\n\`\`\`${editorLanguage}\n// add code here\n\`\`\`\n`;
    setEditForm((prev) => ({
      ...prev,
      content: `${String(prev.content || '').trimEnd()}${snippet}`
    }));
  };

  const runAiRewrite = async (instructionOverride) => {
    const instruction = String(instructionOverride || aiInstruction).trim();
    if (!editingId) {
      return;
    }
    if (!instruction) {
      setError('Add a rewrite instruction first.');
      return;
    }

    setError('');
    setAiRewriteMessage('');
    setAiRewriteLoading(true);
    const controller = new AbortController();
    setRewriteAbortController(controller);
    const result = await onAiRewritePost(editingId, {
      instruction,
      draft: {
        title: editForm.title,
        content: editForm.content,
        section: editForm.section,
        tags: editForm.tags
      }
    }, controller.signal);
    setRewriteAbortController(null);
    setAiRewriteLoading(false);

    if (!result.ok) {
      if (result.message === 'Request cancelled.') {
        setAiRewriteMessage('AI rewrite stopped.');
        return;
      }
      setError(result.message);
      return;
    }

    const rewrittenDraft = result.data?.draft;
    if (!rewrittenDraft) {
      setError('AI rewrite did not return a draft.');
      return;
    }

    setEditForm({
      title: rewrittenDraft.title || editForm.title,
      content: rewrittenDraft.content || editForm.content,
      section: rewrittenDraft.section || editForm.section,
      tags: Array.isArray(rewrittenDraft.tags) ? rewrittenDraft.tags.join(', ') : editForm.tags
    });
    setAiRewriteMessage(result.data?.generation?.rationale || 'AI rewrite applied to the editor. Review it, then save when you are ready.');
  };

  const stopAiRewrite = () => {
    rewriteAbortController?.abort();
    setRewriteAbortController(null);
    setAiRewriteLoading(false);
  };

  const togglePostExpansion = (postId) => {
    setExpandedPosts((current) => ({
      ...current,
      [postId]: !current[postId]
    }));
  };

  useEffect(() => () => {
    rewriteAbortController?.abort();
  }, [rewriteAbortController]);

  if (!currentUser) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <h2 className="mb-2">My Posts</h2>
          <p className="muted mb-3">You need to be logged in to manage your posts.</p>
          <Link to="/login" className="forum-primary-btn text-decoration-none">Login</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell">
      <section className="panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <p className="type-kicker mb-2">Workspace</p>
            <h2 className="mb-1 type-title-md">My Posts</h2>
            <p className="type-body mb-0">Review active posts, moderated removals, and appeal windows.</p>
          </div>
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">Back to Forum</Link>
        </div>

        {(message || error) && (
          <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-3`}>
            {error || message}
          </div>
        )}

        <div className="forum-feed">
          {visiblePosts.map((post) => {
            const isEditing = editingId === post.id;
            const isModerated = Boolean(post.moderation?.isDeleted);
            const deadline = getAppealDeadline(post.moderation);
            const appealExpired = Boolean(deadline && Date.now() > deadline);

            return (
              <article key={post.id} className={`forum-post-card ${isModerated ? 'moderated-post-card' : ''}`}>
                <div className="forum-post-meta-row mb-2">
                  <div className="forum-post-kicker">
                    {post.forum?.name && post.forum?.slug ? (
                      <Link to={`/forum/${post.forum.slug}`} className="forum-origin-chip">
                        <span className="forum-origin-chip-label">Forum</span>
                        <span>{post.forum.name}</span>
                      </Link>
                    ) : (
                      <span className="forum-origin-chip is-static">
                        <span className="forum-origin-chip-label">Forum</span>
                        <span>{post.forum?.name || 'General'}</span>
                      </span>
                    )}
                    <span className="forum-tag">{getSectionLabel(post.section)}</span>
                  </div>
                  <span className="muted forum-time">{formatTime(post.createdAt)}</span>
                </div>

                {isModerated && (
                  <div className="moderation-banner mb-3">
                    <strong>Removed by admin.</strong>{' '}
                    {post.moderation.deletedReason || 'No reason provided.'}
                    {deadline && (
                      <span> Appeal deadline: {formatTime(deadline)}</span>
                    )}
                    {post.moderation.appealRequestedAt && (
                      <span> Appeal submitted on {formatTime(post.moderation.appealRequestedAt)}.</span>
                    )}
                  </div>
                )}

                {isEditing ? (
                  <form onSubmit={submitEdit} className="forum-form">
                    <div className="mb-2">
                      <input
                        className="form-control forum-input"
                        value={editForm.title}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div className="mb-2">
                      <Select
                        options={editSectionOptions}
                        value={editForm.section}
                        onChange={(nextValue) => setEditForm((prev) => ({ ...prev, section: nextValue }))}
                      />
                    </div>
                    <div className="mb-2">
                      <input
                        className="form-control forum-input"
                        value={editForm.tags}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, tags: e.target.value }))}
                      />
                    </div>
                    <div className="mb-2">
                      <div className="composer-toolbar">
                        <Select
                          options={codeLanguageOptions}
                          value={editorLanguage}
                          onChange={setEditorLanguage}
                          className="code-language-select"
                        />
                        <button type="button" className="forum-secondary-btn" onClick={insertCodeTemplate}>
                          Insert Code Block
                        </button>
                        <button
                          type="button"
                          className="forum-secondary-btn"
                          onClick={() => setAiRewriteOpen((current) => !current)}
                        >
                          {aiRewriteOpen ? 'Hide AI Rewrite' : 'Open AI Rewrite'}
                        </button>
                        <button
                          type="button"
                          className="forum-secondary-btn"
                          onClick={() => setShowPreview((current) => !current)}
                        >
                          {showPreview ? 'Hide Preview' : 'Show Preview'}
                        </button>
                      </div>
                      <div data-color-mode="dark" className="markdown-editor-shell">
                        <MDEditor
                          value={editForm.content}
                          onChange={(value) => setEditForm((prev) => ({ ...prev, content: value || '' }))}
                          preview="edit"
                          height={280}
                        />
                      </div>

                      {showPreview && (
                        <section className="settings-card mt-3 my-posts-preview-shell">
                          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                            <div>
                              <h4 className="mb-1">Post Preview</h4>
                              <p className="muted mb-0">This is how the post will roughly look after publishing.</p>
                            </div>
                            <div className="forum-post-kicker">
                              {editingPost?.forum?.name && editingPost?.forum?.slug ? (
                                <Link to={`/forum/${editingPost.forum.slug}`} className="forum-origin-chip">
                                  <span className="forum-origin-chip-label">Forum</span>
                                  <span>{editingPost.forum.name}</span>
                                </Link>
                              ) : (
                                <span className="forum-origin-chip is-static">
                                  <span className="forum-origin-chip-label">Forum</span>
                                  <span>{editingPost?.forum?.name || 'General'}</span>
                                </span>
                              )}
                              <span className="forum-tag">{getSectionLabel(editForm.section)}</span>
                            </div>
                          </div>

                          <h3 className="post-detail-title my-posts-preview-title">{editForm.title || 'Untitled draft'}</h3>

                          {!!String(editForm.tags || '').trim() && (
                            <div className="post-tag-row mb-3">
                              {String(editForm.tags)
                                .split(',')
                                .map((tag) => tag.trim())
                                .filter(Boolean)
                                .map((tag) => (
                                  <span key={`preview-${tag}`} className="post-tag-pill">#{tag}</span>
                                ))}
                            </div>
                          )}

                          <MarkdownBlock content={editForm.content} className="post-detail-content my-posts-preview-content" />
                        </section>
                      )}
                    </div>

                    {aiRewriteOpen && (
                      <section className="settings-card mb-3">
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                          <div>
                            <h4 className="mb-1">AI Rewrite</h4>
                            <p className="muted mb-0">Use OpenAI to polish, shorten, expand, or restyle this post draft.</p>
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
                          placeholder="Example: tighten the intro, keep the technical details, and make the conclusion more actionable."
                        />
                        <div className="forum-actions mt-3">
                          {aiRewriteLoading && (
                            <button
                              type="button"
                              className="forum-secondary-btn"
                              onClick={stopAiRewrite}
                            >
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

                    <div className="forum-actions">
                      <button type="submit" className="forum-primary-btn">Save</button>
                      <button
                        type="button"
                        className="forum-secondary-btn"
                        onClick={() => {
                          setEditingId(null);
                          setShowPreview(false);
                          setAiRewriteOpen(false);
                          setAiRewriteMessage('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h5 className="mb-1">{post.title}</h5>
                    {!!post.tags?.length && (
                      <div className="post-tag-row mb-2">
                        {post.tags.map((tag) => (
                          <span key={`${post.id}-${tag}`} className="post-tag-pill">#{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="mb-2">
                      <p className={`forum-post-preview ${expandedPosts[post.id] ? 'is-expanded' : 'is-clamped'}`}>
                        {post.content}
                      </p>
                      {hasExpandablePreview(post.content) && (
                        <button
                          type="button"
                          className="forum-inline-toggle"
                          onClick={() => togglePostExpansion(post.id)}
                        >
                          {expandedPosts[post.id] ? 'Collapse' : 'Expand'}
                        </button>
                      )}
                    </div>
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <small className="muted">
                        {isModerated ? 'Hidden from public forum' : 'Published by you'}
                      </small>
                      {!isModerated && (
                        <div className="forum-actions">
                          <button type="button" className="forum-secondary-btn" onClick={() => startEdit(post)}>Edit</button>
                          <button type="button" className="forum-secondary-btn" onClick={() => startEdit(post, { openAiPanel: true })}>AI Improve</button>
                          <button type="button" className="forum-danger-btn" onClick={() => handleDelete(post.id)}>Delete</button>
                        </div>
                      )}
                    </div>

                    {isModerated && !post.moderation.appealRequestedAt && !appealExpired && (
                      <div className="mt-3">
                        <label className="form-label">Appeal message</label>
                        <textarea
                          className="form-control forum-input"
                          rows={3}
                          value={appealNotes[post.id] || ''}
                          onChange={(e) => setAppealNotes((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          placeholder="Explain why this post should be restored."
                        />
                        <div className="forum-actions mt-2">
                          <button type="button" className="forum-primary-btn" onClick={() => handleAppeal(post.id)}>
                            Request Restore
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}

          {visiblePosts.length === 0 && (
            <section className="settings-card">
              <h4 className="mb-2">No posts yet</h4>
              <p className="muted mb-3">Once you publish in the forum, your posts will appear here for management.</p>
              <Link to="/forum" className="forum-primary-btn text-decoration-none">Create Your First Post</Link>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
