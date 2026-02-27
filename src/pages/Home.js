import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const tags = ['Coding Hack', 'Project Showcase', 'Interview Tip', 'Career', 'Discussion'];

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function Home({ posts, currentUser, onCreatePost, onUpdatePost, onDeletePost }) {
  const [form, setForm] = useState({ title: '', content: '', tag: tags[0] });
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', content: '', tag: tags[0] });

  const orderedPosts = useMemo(
    () => [...posts].sort((a, b) => b.createdAt - a.createdAt),
    [posts]
  );

  const submitPost = async (event) => {
    event.preventDefault();
    setMessage('');
    if (!form.title.trim() || !form.content.trim()) {
      setMessage('Title and content are required.');
      return;
    }
    const result = await onCreatePost(form);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setForm({ title: '', content: '', tag: tags[0] });
    setMessage('Post published.');
  };

  const startEdit = (post) => {
    setEditingId(post.id);
    setEditForm({
      title: post.title,
      content: post.content,
      tag: tags.find((tag) => tag.toLowerCase().replace(/\s+/g, '-') === post.tag) || tags[0]
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

  return (
    <div className="container page-shell">
      <section className="hero-card mb-4">
        <h1 className="hero-title">LearnFromUs Community Forum</h1>
        <p className="hero-copy mb-0">
          Post coding hacks, showcase what you built, and get feedback from people shipping real products.
        </p>
      </section>

      <div className="row g-4">
        <div className="col-lg-4">
          <section className="panel h-100">
            <h3 className="mb-2">Create a Post</h3>
            <p className="muted mb-3">
              {currentUser ? `Posting as ${currentUser.name}` : 'Login required to post.'}
            </p>

            {!currentUser ? (
              <Link to="/login" className="forum-primary-btn d-inline-block text-center w-100 text-decoration-none">
                Login to Post
              </Link>
            ) : (
              <form onSubmit={submitPost} className="forum-form">
                <div className="mb-3">
                  <label className="form-label">Title</label>
                  <input
                    className="form-control forum-input"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="One clear sentence"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Tag</label>
                  <select
                    className="form-select forum-input"
                    value={form.tag}
                    onChange={(e) => setForm((prev) => ({ ...prev, tag: e.target.value }))}
                  >
                    {tags.map((tag) => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-2">
                  <label className="form-label">Content</label>
                  <textarea
                    className="form-control forum-input"
                    rows={5}
                    value={form.content}
                    onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="Share the idea, code approach, and why it worked."
                  />
                </div>

                {message && <p className="mt-3 mb-0 muted">{message}</p>}

                <button type="submit" className="forum-primary-btn mt-4 w-100">Publish</button>
              </form>
            )}
          </section>
        </div>

        <div className="col-lg-8">
          <section className="panel">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="mb-0">Latest Posts</h3>
              <span className="muted">{orderedPosts.length} posts</span>
            </div>

            <div className="forum-feed">
              {orderedPosts.map((post) => {
                const isOwner = currentUser && currentUser.id === post.authorId;
                const isEditing = editingId === post.id;

                return (
                  <article key={post.id} className="forum-post-card">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="forum-tag">{post.tag}</span>
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
                            value={editForm.tag}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, tag: e.target.value }))}
                          >
                            {tags.map((tag) => (
                              <option key={tag} value={tag}>{tag}</option>
                            ))}
                          </select>
                        </div>
                        <div className="mb-2">
                          <textarea
                            className="form-control forum-input"
                            rows={4}
                            value={editForm.content}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, content: e.target.value }))}
                          />
                        </div>
                        <div className="forum-actions">
                          <button type="submit" className="forum-primary-btn">Save</button>
                          <button type="button" className="forum-secondary-btn" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <h5 className="mb-1">{post.title}</h5>
                        <p className="mb-2">{post.content}</p>
                        <div className="d-flex justify-content-between align-items-center">
                          <small className="muted">Posted by {post.authorName}</small>
                          {isOwner && (
                            <div className="forum-actions">
                              <button type="button" className="forum-secondary-btn" onClick={() => startEdit(post)}>Edit</button>
                              <button type="button" className="forum-danger-btn" onClick={() => handleDelete(post.id)}>Delete</button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </article>
                );
              })}

              {orderedPosts.length === 0 && (
                <p className="muted mb-0">No posts yet. Be the first to publish one.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
