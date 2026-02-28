import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const sectionGroups = [
  {
    title: 'Software Engineering',
    items: [
      { value: 'frontend', label: 'Front End' },
      { value: 'backend', label: 'Back End' },
      { value: 'algorithms', label: 'Algorithms' },
      { value: 'system-design', label: 'System Design' },
      { value: 'ui-ux', label: 'UI / UX' },
      { value: 'devops-cloud', label: 'DevOps / Cloud' },
      { value: 'mobile', label: 'Mobile' },
      { value: 'testing-qa', label: 'Testing / QA' },
      { value: 'security', label: 'Security' },
      { value: 'sde-general', label: 'General SDE' }
    ]
  },
  {
    title: 'Data Science & AI',
    items: [
      { value: 'ai-llm', label: 'AI / LLM' },
      { value: 'mle', label: 'MLE' },
      { value: 'deep-learning', label: 'Deep Learning' },
      { value: 'data-engineering', label: 'Data Engineering' },
      { value: 'statistics', label: 'Statistics' },
      { value: 'analytics', label: 'Analytics' },
      { value: 'experimentation', label: 'Experimentation' },
      { value: 'visualization', label: 'Visualization' },
      { value: 'ds-general', label: 'General DS' }
    ]
  }
];

const allSections = sectionGroups.flatMap((group) => group.items);
const defaultSection = allSections[0];
const codeLanguages = ['javascript', 'typescript', 'python', 'sql', 'bash', 'json'];

function getSectionLabel(value) {
  const found = allSections.find((item) => item.value === value);
  return found ? found.label : value;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function MyPosts({ currentUser, posts, onUpdatePost, onDeletePost }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', content: '', section: defaultSection.value, tags: '' });
  const [message, setMessage] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('javascript');

  const myPosts = useMemo(
    () =>
      posts
        .filter((post) => post.authorId === currentUser?.id)
        .sort((a, b) => b.createdAt - a.createdAt),
    [posts, currentUser]
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
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    const result = await onUpdatePost(editingId, editForm);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setEditingId(null);
    setMessage('Post updated.');
  };

  const handleDelete = async (postId) => {
    const result = await onDeletePost(postId);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (editingId === postId) {
      setEditingId(null);
    }
    setMessage('Post deleted.');
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
            <p className="type-body mb-0">Review, edit, or remove everything you have published.</p>
          </div>
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">Back to Forum</Link>
        </div>

        {message && <div className="settings-alert is-success mb-3">{message}</div>}

        <div className="forum-feed">
          {myPosts.map((post) => {
            const isEditing = editingId === post.id;

            return (
              <article key={post.id} className="forum-post-card">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="forum-tag">{getSectionLabel(post.section)}</span>
                  <span className="muted forum-time">{formatTime(post.createdAt)}</span>
                </div>

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
                      <select
                        className="form-select forum-input"
                        value={editForm.section}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, section: e.target.value }))}
                      >
                        {sectionGroups.map((group) => (
                          <optgroup key={group.title} label={group.title}>
                            {group.items.map((item) => (
                              <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
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
                        <select
                          className="form-select forum-input code-language-select"
                          value={editorLanguage}
                          onChange={(e) => setEditorLanguage(e.target.value)}
                        >
                          {codeLanguages.map((language) => (
                            <option key={language} value={language}>{language}</option>
                          ))}
                        </select>
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
                      <small className="muted">Published by you</small>
                      <div className="forum-actions">
                        <button type="button" className="forum-secondary-btn" onClick={() => startEdit(post)}>Edit</button>
                        <button type="button" className="forum-danger-btn" onClick={() => handleDelete(post.id)}>Delete</button>
                      </div>
                    </div>
                  </>
                )}
              </article>
            );
          })}

          {myPosts.length === 0 && (
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
