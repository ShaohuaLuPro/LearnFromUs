import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { apiDeleteMediaAsset } from '../api';
import MarkdownBlock from '../components/MarkdownBlock';
import Select from '../components/Select';
import CoverImageUploader from '../components/post/CoverImageUploader';
import { authStorage } from '../lib/authStorage';
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

function contentReferencesUploadedAsset(content, asset) {
  const draftContent = String(content || '');
  const references = [
    asset?.token,
    asset?.source,
    asset?.storageUrl,
    asset?.id ? `/api/media/${asset.id}` : ''
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return references.some((reference) => draftContent.includes(reference));
}

function getUnusedUploadedAssets(uploadedAssets, content) {
  return uploadedAssets.filter((asset) => !contentReferencesUploadedAsset(content, asset));
}

export default function MyPostEditPage({
  currentUser,
  forums,
  onUpdatePost,
  onAiRewritePost,
  onDeletePost,
  onGetMyPosts
}) {
  const { postId } = useParams();
  const navigate = useNavigate();
  const fallbackSectionValue = useMemo(() => getDefaultSectionValue(forums), [forums]);
  const [rewriteAbortController, setRewriteAbortController] = useState(null);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState({ title: '', content: '', section: fallbackSectionValue, tags: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('javascript');
  const [aiRewriteOpen, setAiRewriteOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiRewriteMessage, setAiRewriteMessage] = useState('');
  const [aiRewriteLoading, setAiRewriteLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [uploadedEditAssets, setUploadedEditAssets] = useState([]);

  const cleanupUploadedEditAssets = useCallback(async (mode = 'all', content = '') => {
    if (uploadedEditAssets.length === 0) {
      return;
    }

    const token = authStorage.getToken();
    if (!token) {
      setUploadedEditAssets(mode === 'unused'
        ? uploadedEditAssets.filter((asset) => contentReferencesUploadedAsset(content, asset))
        : []);
      return;
    }

    const assetsToDelete = mode === 'unused'
      ? getUnusedUploadedAssets(uploadedEditAssets, content)
      : uploadedEditAssets;

    if (assetsToDelete.length === 0) {
      if (mode === 'all') {
        setUploadedEditAssets([]);
      }
      return;
    }

    await Promise.allSettled(
      assetsToDelete.map((asset) => apiDeleteMediaAsset(asset.id, token))
    );

    if (mode === 'unused') {
      setUploadedEditAssets((current) => current.filter((asset) => contentReferencesUploadedAsset(content, asset)));
      return;
    }

    setUploadedEditAssets([]);
  }, [uploadedEditAssets]);

  const loadPost = useCallback(async () => {
    if (!postId) {
      setLoading(false);
      setError('Post not found.');
      return;
    }

    setLoading(true);
    setError('');
    const result = await onGetMyPosts();
    if (!result.ok) {
      setLoading(false);
      setError(result.message);
      return;
    }

    const nextPost = (result.posts || []).find((entry) => entry.id === postId && entry.authorId === currentUser?.id) || null;
    setPost(nextPost);
    setLoading(false);

    if (!nextPost) {
      setError('This post could not be found in your list.');
      return;
    }

    setEditForm({
      title: nextPost.title,
      content: nextPost.content,
      section: nextPost.section || getDefaultSectionValue(nextPost.forum?.sectionScope || [], forums),
      tags: (nextPost.tags || []).join(', ')
    });
  }, [currentUser?.id, forums, onGetMyPosts, postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  useEffect(() => () => {
    rewriteAbortController?.abort();
  }, [rewriteAbortController]);

  const editSectionOptions = useMemo(() => {
    const scopedSections = post?.forum?.sectionScope;
    return getSectionSelectOptions(scopedSections?.length ? scopedSections : forums);
  }, [forums, post]);

  const isModerated = Boolean(post?.moderation?.isDeleted);
  const isPermanentlyDeleted = Boolean(post?.moderation?.isPermanentlyDeleted);
  const appealLog = post?.moderation?.appealLog || [];
  const hasAppealHistory = appealLog.length > 0 || Boolean(post?.moderation?.appealRequestedAt);
  const postStatus = isPermanentlyDeleted
    ? { label: 'Removed', tone: 'removed' }
    : isModerated
      ? { label: 'Under review', tone: 'review' }
      : { label: 'Published', tone: 'published' };

  const goBack = useCallback(async () => {
    await cleanupUploadedEditAssets('all');
    navigate('/my-posts');
  }, [cleanupUploadedEditAssets, navigate]);

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!postId) {
      return;
    }
    if (isCoverUploading) {
      setError('Please wait for the cover image upload to finish before saving.');
      return;
    }

    setError('');
    setMessage('');
    const finalContent = editForm.content;
    const result = await onUpdatePost(postId, editForm);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await cleanupUploadedEditAssets('unused', finalContent);
    navigate('/my-posts');
  };

  const handleDelete = async () => {
    if (!postId) {
      return;
    }
    if (!window.confirm('Delete this post? This cannot be undone.')) {
      return;
    }

    setError('');
    setMessage('');
    const result = await onDeletePost(postId);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await cleanupUploadedEditAssets('all');
    navigate('/my-posts');
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
    if (!postId) {
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
    const result = await onAiRewritePost(postId, {
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

  if (!currentUser) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <h2 className="mb-2">Edit Post</h2>
          <p className="muted mb-3">You need to be logged in to edit your post.</p>
          <Link to="/login" className="forum-primary-btn text-decoration-none">Login</Link>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <p className="muted mb-0">Loading post editor...</p>
        </section>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container page-shell">
        <section className="panel">
          <h2 className="mb-2">Edit Post</h2>
          <p className="muted mb-3">{error || 'This post is unavailable.'}</p>
          <Link to="/my-posts" className="forum-secondary-btn text-decoration-none">Back to My Posts</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="container page-shell my-post-edit-page">
      <div className="forum-layout my-post-edit-surface">
        <div className="forum-main forum-main-full">
          <section className="my-post-edit-header mb-3" aria-label="Edit post header">
            <div className="my-post-edit-heading-row">
              <div>
                <h1 className="community-feed-title mb-1">Edit Post</h1>
                <p className="my-post-edit-subtext mb-0">Refine your post with clear content editing and lightweight publishing controls.</p>
              </div>
              <div className="my-post-edit-header-actions">
                {hasAppealHistory && (
                  <Link to={`/my-posts/${post.id}/appeal`} className="forum-secondary-btn text-decoration-none">Appeal Record</Link>
                )}
                <Link to={`/forum/post/${post.id}`} className="forum-secondary-btn text-decoration-none">View Post</Link>
                <button type="button" className="forum-secondary-btn" onClick={() => { void goBack(); }}>Back to My Posts</button>
              </div>
            </div>

            <div className="my-post-edit-summary-row">
              {post.forum?.name && post.forum?.slug ? (
                <Link to={`/forum/${post.forum.slug}`} className="forum-origin-chip">
                  <span className="forum-origin-chip-label">Space</span>
                  <span>{post.forum.name}</span>
                </Link>
              ) : (
                <span className="forum-origin-chip is-static">
                  <span className="forum-origin-chip-label">Space</span>
                  <span>{post.forum?.name || 'General'}</span>
                </span>
              )}
              <span className="forum-tag">{getSectionLabel(editForm.section || post.section)}</span>
              <span className={`my-post-edit-status-pill is-${postStatus.tone}`}>{postStatus.label}</span>
              <span className="my-post-edit-meta-chip">Created {formatTime(post.createdAt)}</span>
              <span className="my-post-edit-meta-chip">Updated {formatTime(post.updatedAt || post.createdAt)}</span>
            </div>
          </section>

          {(message || error) && (
            <div className={`settings-alert ${error ? 'is-error' : 'is-success'} mb-3`}>
              {error || message}
            </div>
          )}

          {(isModerated || hasAppealHistory) && (
            <div className={`moderation-banner mb-3 ${isPermanentlyDeleted ? 'is-danger' : ''}`}>
              <strong>
                {isPermanentlyDeleted
                  ? 'Permanently deleted by admin.'
                  : isModerated
                    ? 'Removed by admin.'
                    : 'Moderation history.'}
              </strong>{' '}
              {isPermanentlyDeleted
                ? (post.moderation.permanentDeleteNote || post.moderation.deletedReason || 'No final decision note provided.')
                : isModerated
                  ? (post.moderation.deletedReason || 'No reason provided.')
                  : 'This post has a saved appeal record you can review from the appeal page.'}
            </div>
          )}

          {isPermanentlyDeleted ? (
            <section className="settings-card my-post-edit-locked-card">
              <h3 className="mb-2">Editing is closed for this post</h3>
              <p className="muted mb-3">This post already has a final permanent delete decision, so it can no longer be edited.</p>
              <div className="forum-actions">
                {hasAppealHistory && (
                  <Link to={`/my-posts/${post.id}/appeal`} className="forum-secondary-btn text-decoration-none">Open Appeal Record</Link>
                )}
                <button type="button" className="forum-secondary-btn" onClick={() => { void goBack(); }}>Back to My Posts</button>
              </div>
            </section>
          ) : (
            <form onSubmit={submitEdit} className="my-post-edit-workspace">
              <section className="my-post-edit-main-column">
                {isModerated && (
                  <div className="moderation-banner">
                    <strong>Editing a moderated post.</strong>{' '}
                    Your changes will be saved, but the post will stay hidden until an admin restores it.
                  </div>
                )}

                <article className="my-post-edit-card is-title-card">
                  <label className="form-label" htmlFor="edit-post-title">Title</label>
                  <input
                    id="edit-post-title"
                    className="form-control forum-input my-post-edit-input"
                    value={editForm.title}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Write a clear, specific title"
                    autoComplete="off"
                  />
                </article>

                <article className="my-post-edit-card">
                  <div className="my-post-edit-card-head">
                    <div>
                      <h3 className="my-post-edit-card-title mb-1">Content</h3>
                      <p className="muted mb-0">Focus on clarity and structure so readers can scan quickly.</p>
                    </div>
                  </div>

                  <CoverImageUploader
                    content={editForm.content}
                    onTransformContent={(transformer) => {
                      setEditForm((prev) => ({ ...prev, content: transformer(String(prev.content || '')) }));
                    }}
                    onAssetUploaded={(asset) => {
                      setUploadedEditAssets((current) => (
                        current.some((entry) => entry.id === asset.id)
                          ? current
                          : [...current, asset]
                      ));
                    }}
                    onUploadingChange={setIsCoverUploading}
                    onError={(nextMessage) => setError(nextMessage)}
                    className="mb-3"
                  />

                  <div className="my-post-edit-toolbar">
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

                  <div data-color-mode="light" className="markdown-editor-shell my-post-edit-editor-shell">
                    <MDEditor
                      value={editForm.content}
                      onChange={(value) => setEditForm((prev) => ({ ...prev, content: value || '' }))}
                      preview="edit"
                      height={420}
                    />
                  </div>
                </article>

                {aiRewriteOpen && (
                  <article className="my-post-edit-card">
                    <div className="my-post-edit-card-head">
                      <div>
                        <h3 className="my-post-edit-card-title mb-1">AI Rewrite</h3>
                        <p className="muted mb-0">Polish, shorten, expand, or restyle this draft while you edit.</p>
                      </div>
                      <span className="my-post-edit-card-note">Works on current editor content</span>
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

                    <label className="form-label" htmlFor="ai-rewrite-custom-instruction">Custom instruction</label>
                    <textarea
                      id="ai-rewrite-custom-instruction"
                      className="form-control forum-input my-post-edit-textarea"
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
                  </article>
                )}

                {showPreview && (
                  <article className="my-post-edit-card my-post-edit-preview-card">
                    <div className="my-post-edit-card-head">
                      <div>
                        <h3 className="my-post-edit-card-title mb-1">Preview</h3>
                        <p className="muted mb-0">A live preview of your post content.</p>
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
                  </article>
                )}
              </section>

              <aside className="my-post-edit-side-column">
                <article className="my-post-edit-card is-side-card">
                  <h3 className="my-post-edit-card-title mb-2">Post Settings</h3>

                  <label className="form-label mb-2">Section</label>
                  <Select
                    options={editSectionOptions}
                    value={editForm.section}
                    onChange={(nextValue) => setEditForm((prev) => ({ ...prev, section: nextValue }))}
                  />

                  <label className="form-label mt-3 mb-2" htmlFor="edit-post-tags">Tags</label>
                  <input
                    id="edit-post-tags"
                    className="form-control forum-input my-post-edit-input"
                    value={editForm.tags}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, tags: event.target.value }))}
                    placeholder="react, auth, postgres"
                    autoComplete="off"
                  />

                  <p className="my-post-edit-helper mb-0">Separate tags with commas.</p>
                </article>

                <article className="my-post-edit-card is-side-card">
                  <h3 className="my-post-edit-card-title mb-2">Save Changes</h3>
                  <div className="my-post-edit-save-actions">
                    <button type="submit" className="forum-primary-btn" disabled={isCoverUploading}>
                      {isCoverUploading ? 'Uploading Cover...' : 'Save'}
                    </button>
                    <button type="button" className="forum-secondary-btn" onClick={() => { void goBack(); }}>Cancel</button>
                  </div>
                  <p className="my-post-edit-helper mb-0">Your edits update this post in place.</p>
                </article>

                <article className="my-post-edit-card is-side-card is-danger-zone">
                  <h3 className="my-post-edit-card-title mb-2">Danger Zone</h3>
                  <p className="my-post-edit-helper mb-2">Delete this post permanently. This action cannot be undone.</p>
                  <button type="button" className="forum-danger-btn" onClick={handleDelete}>Delete Post</button>
                </article>
              </aside>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
