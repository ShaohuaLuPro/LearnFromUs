import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import Select from '../components/Select';
import {
  allSections,
  defaultSection,
  getSectionLabel,
  sectionGroups,
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

function getPreview(content) {
  const text = String(content || '').trim();
  if (text.length <= 180) {
    return text;
  }
  return `${text.slice(0, 180).trimEnd()}...`;
}

export default function Home({
  posts,
  pagination,
  currentFilters,
  loadingPosts,
  currentUser,
  onLoadPosts,
  onCreatePost
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({ title: '', content: '', section: defaultSection.value, tags: '' });
  const [message, setMessage] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(currentFilters?.q || '');
  const [selectedSections, setSelectedSections] = useState(
    sectionId ? [sectionId] : (currentFilters?.section || [])
  );
  const [composerLanguage, setComposerLanguage] = useState('javascript');

  const applyComposerDraft = (draft) => {
    if (!draft) {
      return;
    }

    setForm({
      title: String(draft.title || ''),
      content: String(draft.content || ''),
      section: String(draft.section || defaultSection.value) || defaultSection.value,
      tags: Array.isArray(draft.tags) ? draft.tags.join(', ') : String(draft.tags || '')
    });
    setMessage('');
    setIsComposerOpen(true);
  };

  const sectionCounts = useMemo(() => {
    const counts = Object.fromEntries(allSections.map((item) => [item.value, 0]));
    for (const post of posts) {
      const key = post.section || 'sde-general';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [posts]);

  const groupCounts = useMemo(
    () =>
      Object.fromEntries(
        sectionGroups.map((group) => [
          group.title,
          group.items.reduce((sum, item) => sum + (sectionCounts[item.value] || 0), 0)
        ])
      ),
    [sectionCounts]
  );

  useEffect(() => {
    if (sectionId) {
      setSelectedSections([sectionId]);
      return;
    }
    setSelectedSections(currentFilters?.section || []);
  }, [sectionId, currentFilters]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    if (searchParams.get('compose') === '1') {
      setMessage('');
      setIsComposerOpen(true);
    }
  }, [currentUser, searchParams]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const composerDraft = location.state?.composerDraft;
    if (!composerDraft) {
      return;
    }

    applyComposerDraft(composerDraft);
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null
    });
  }, [currentUser, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onLoadPosts({
        q: searchQuery.trim(),
        section: selectedSections,
        page: 1,
        pageSize: 'all'
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onLoadPosts, searchQuery, selectedSections]);

  const toggleSection = (sectionValue) => {
    if (sectionId) {
      navigate('/forum');
    }
    setSelectedSections((current) =>
      current.includes(sectionValue)
        ? current.filter((value) => value !== sectionValue)
        : [...current, sectionValue]
    );
  };

  const clearSections = () => {
    if (sectionId) {
      navigate('/forum');
    }
    setSelectedSections([]);
  };

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
    setForm({ title: '', content: '', section: defaultSection.value, tags: '' });
    setSearchQuery('');
    setSelectedSections([]);
    if (sectionId) {
      navigate('/forum');
    }
    await onLoadPosts({ q: '', section: [], page: 1, pageSize: 'all' });
    setIsComposerOpen(false);
    setMessage('Post published.');
  };

  const toggleTagFilter = (tag) => {
    setSearchQuery((current) => (current === tag ? '' : tag));
  };

  const insertCodeTemplate = () => {
    const snippet = `\n\`\`\`${composerLanguage}\n// add code here\n\`\`\`\n`;
    setForm((prev) => ({
      ...prev,
      content: `${String(prev.content || '').trimEnd()}${snippet}`
    }));
  };

  return (
    <div className="container page-shell">
      <section className="hero-card mb-4">
        <h1 className="hero-title">LearnFromUs Community Forum</h1>
        <p className="hero-copy mb-0">
          Share practical ideas across software engineering and data science, filter by section, and drill
          down further with tag search.
        </p>
      </section>

      <section className="panel mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h3 className="mb-1 type-title-md">Sections</h3>
            <p className="type-body mb-0">Browse the forum by discipline, then narrow by tags.</p>
          </div>
          <span className="muted">{pagination?.total || 0} matching posts</span>
        </div>

        <div className="section-grid">
          {sectionGroups.map((group) => (
            <div key={group.title} className="section-card is-open">
              <div className="section-group-toggle">
                <span className="section-group-copy">
                  <span className="section-card-title mb-0">{group.title}</span>
                  <span className="section-group-summary">
                    {groupCounts[group.title] || 0} posts on this page across {group.items.length} sections
                  </span>
                </span>
                <span className="section-group-meta">
                  <span className="section-group-total">{groupCounts[group.title] || 0}</span>
                </span>
              </div>
              <div className="section-chip-wrap mt-3">
                {group.items.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`section-chip ${selectedSections.includes(item.value) ? 'is-active' : ''}`}
                    onClick={() => toggleSection(item.value)}
                  >
                    <span>{item.label}</span>
                    <span className="section-count">{sectionCounts[item.value] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selectedSections.length > 0 && (
          <div className="section-filter-row mt-3">
            <button
              type="button"
              className="section-filter is-active"
              onClick={clearSections}
            >
              All Sections
            </button>
            {selectedSections.map((sectionValue) => (
              <button
                key={sectionValue}
                type="button"
                className="section-filter"
                onClick={() => toggleSection(sectionValue)}
              >
                {getSectionLabel(sectionValue)}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="row g-4">
        <div className="col-12">
          <section className="panel">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <h3 className="mb-0 type-title-md">Latest Posts</h3>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="muted">{pagination?.total || 0} posts</span>
                {!currentUser ? (
                  <Link to="/login" className="forum-primary-btn text-decoration-none">
                    Login to Post
                  </Link>
                ) : (
                  <button type="button" className="forum-primary-btn" onClick={() => { setMessage(''); setIsComposerOpen(true); }}>
                    Create a Post
                  </button>
                )}
              </div>
            </div>

            <div className="tag-toolbar mb-3">
              <input
                className="form-control forum-input tag-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, content, tags, section"
              />
              {searchQuery && (
                <button type="button" className="forum-secondary-btn" onClick={() => setSearchQuery('')}>
                  Clear Search
                </button>
              )}
            </div>

            {loadingPosts && <p className="muted mb-3">Refreshing posts...</p>}

            <div className="forum-feed">
              {posts.map((post) => (
                <article key={post.id} className="forum-post-card">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="forum-tag">{getSectionLabel(post.section)}</span>
                    <span className="muted forum-time">{formatTime(post.createdAt)}</span>
                  </div>

                  <h5 className="mb-1">
                    <Link to={`/forum/post/${post.id}`} className="post-title-link">
                      {post.title}
                    </Link>
                  </h5>
                  {!!post.tags?.length && (
                    <div className="post-tag-row mb-2">
                      {post.tags.map((tag) => (
                        <button
                          key={`${post.id}-${tag}`}
                          type="button"
                          className={`post-tag-pill ${searchQuery === tag ? 'is-active' : ''}`}
                          onClick={() => toggleTagFilter(tag)}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mb-2 forum-post-preview">{getPreview(post.content)}</p>
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <small className="muted">
                      Posted by{' '}
                      <Link to={`/users/${post.authorId}`} className="post-author-link">
                        {post.authorName}
                      </Link>
                    </small>
                    <Link to={`/forum/post/${post.id}`} className="post-read-link">
                      Read more
                    </Link>
                  </div>
                </article>
              ))}

              {!loadingPosts && posts.length === 0 && (
                <p className="muted mb-0">No posts match the current section and tag filters.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {isComposerOpen && currentUser && (
        <div className="forum-modal-backdrop" onClick={() => setIsComposerOpen(false)}>
          <section className="forum-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h3 className="mb-1">Create a Post</h3>
                <p className="muted mb-0">Posting as {currentUser.name}</p>
              </div>
              <button type="button" className="forum-close-btn" onClick={() => setIsComposerOpen(false)}>Close</button>
            </div>

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
                <label className="form-label">Section</label>
                <Select
                  options={sectionSelectOptions}
                  value={form.section}
                  onChange={(nextValue) => setForm((prev) => ({ ...prev, section: nextValue }))}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Tags</label>
                <input
                  className="form-control forum-input"
                  value={form.tags}
                  onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="react, auth, postgres"
                />
                <div className="form-help">Optional. Separate tags with commas.</div>
              </div>

              <div className="mb-2">
                <label className="form-label">Content</label>
                <div className="composer-toolbar">
                  <Select
                    options={codeLanguageOptions}
                    value={composerLanguage}
                    onChange={setComposerLanguage}
                    className="code-language-select"
                  />
                  <button type="button" className="forum-secondary-btn" onClick={insertCodeTemplate}>
                    Insert Code Block
                  </button>
                </div>
                <div data-color-mode="dark" className="markdown-editor-shell">
                  <MDEditor
                    value={form.content}
                    onChange={(value) => setForm((prev) => ({ ...prev, content: value || '' }))}
                    preview="edit"
                    height={320}
                    textareaProps={{
                      placeholder: 'Share the idea, code approach, and why it worked.'
                    }}
                  />
                </div>
                <div className="form-help">Choose a language, insert a code block, then paste your code inside it.</div>
              </div>

              {message && <p className="mt-3 mb-0 muted">{message}</p>}

              <div className="forum-actions mt-4">
                <button type="submit" className="forum-primary-btn">Publish</button>
                <button type="button" className="forum-secondary-btn" onClick={() => setIsComposerOpen(false)}>Cancel</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
