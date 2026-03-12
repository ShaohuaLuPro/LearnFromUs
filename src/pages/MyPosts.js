import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import Select from '../components/Select';
import {
  defaultSection,
  getSectionLabel,
  sectionSelectOptions
} from '../lib/sections';

const codeLanguages = ['javascript', 'typescript', 'python', 'sql', 'bash', 'json'];
const codeLanguageOptions = codeLanguages.map((language) => ({
  value: language,
  label: language
}));

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

export default function MyPosts({
  currentUser,
  onUpdatePost,
  onDeletePost,
  onAppealPost,
  onGetMyPosts
}) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', content: '', section: defaultSection.value, tags: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('javascript');
  const [myPosts, setMyPosts] = useState([]);
  const [appealNotes, setAppealNotes] = useState({});

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

  const startEdit = (post) => {
    setEditingId(post.id);
    setEditForm({
      title: post.title,
      content: post.content,
      section: post.section || defaultSection.value,
      tags: (post.tags || []).join(', ')
    });
    setMessage('');
    setError('');
  };

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
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="forum-tag">{getSectionLabel(post.section)}</span>
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
                        options={sectionSelectOptions}
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
                      </div>
                      <div data-color-mode="dark" className="markdown-editor-shell">
                        <MDEditor
                          value={editForm.content}
                          onChange={(value) => setEditForm((prev) => ({ ...prev, content: value || '' }))}
                          preview="edit"
                          height={280}
                        />
                      </div>
                    </div>
                    <div className="forum-actions">
                      <button type="submit" className="forum-primary-btn">Save</button>
                      <button type="button" className="forum-secondary-btn" onClick={() => setEditingId(null)}>Cancel</button>
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
                    <p className="mb-2">{post.content}</p>
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <small className="muted">
                        {isModerated ? 'Hidden from public forum' : 'Published by you'}
                      </small>
                      {!isModerated && (
                        <div className="forum-actions">
                          <button type="button" className="forum-secondary-btn" onClick={() => startEdit(post)}>Edit</button>
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
