import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { apiFollowForum, apiUnfollowForum } from '../api';
import ForumSidebar from '../components/ForumSidebar';
import Select from '../components/Select';
import { authStorage } from '../lib/authStorage';
import {
  getDefaultSectionValue,
  getSectionLabel,
  getSectionOptions,
  getSectionSelectOptions,
  getSectionValues
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

function buildSectionOptionsForForum(forum) {
  return getSectionSelectOptions(forum?.sectionScope || []);
}

function getScopedDefaultSection(forum, forums) {
  return getDefaultSectionValue(forum?.sectionScope || [], forums);
}

function normalizeSectionInput(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function Home({
  posts,
  forums,
  pagination,
  currentFilters,
  loadingPosts,
  currentUser,
  onLoadPosts,
  onLoadForums,
  onCreatePost,
  onUpdateForumSections,
  onOwnerRemovePost
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { sectionId, forumSlug } = useParams();
  const [searchParams] = useSearchParams();
  const selectedForumSlug = String(forumSlug || '').trim().toLowerCase();
  const selectedForum = useMemo(
    () => forums.find((forum) => forum.slug === selectedForumSlug) || null,
    [forums, selectedForumSlug]
  );
  const availableSectionValues = useMemo(() => getSectionValues(forums), [forums]);
  const fallbackSectionValue = useMemo(
    () => getDefaultSectionValue(availableSectionValues),
    [availableSectionValues]
  );
  const globalSectionOptions = useMemo(
    () => getSectionSelectOptions(availableSectionValues),
    [availableSectionValues]
  );
  const selectedForumOption = selectedForum || null;
  const [sectionScopeCommitted, setSectionScopeCommitted] = useState([]);
  const [sectionScopeDraft, setSectionScopeDraft] = useState([]);
  const [sectionDraft, setSectionDraft] = useState('');
  const [sectionUpdatePending, setSectionUpdatePending] = useState(false);
  const [sectionNotice, setSectionNotice] = useState({ type: '', text: '' });
  const [sectionEditMode, setSectionEditMode] = useState(false);
  const persistedSectionScope = useMemo(
    () => sectionScopeCommitted,
    [sectionScopeCommitted]
  );
  const sectionDisplayScope = useMemo(() => {
    if (!sectionEditMode) {
      return persistedSectionScope;
    }

    return [
      ...persistedSectionScope,
      ...sectionScopeDraft.filter((value) => !persistedSectionScope.includes(value))
    ];
  }, [persistedSectionScope, sectionEditMode, sectionScopeDraft]);
  const visibleSections = useMemo(
    () => getSectionOptions(sectionDisplayScope),
    [sectionDisplayScope]
  );
  const visibleSectionValues = useMemo(
    () => visibleSections.map((item) => item.value),
    [visibleSections]
  );
  const [form, setForm] = useState({
    title: '',
    content: '',
    forumId: '',
    section: 'general',
    tags: ''
  });
  const [message, setMessage] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(currentFilters?.q || '');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedSections, setSelectedSections] = useState(
    sectionId ? [sectionId] : (currentFilters?.section || [])
  );
  const [composerLanguage, setComposerLanguage] = useState('javascript');
  const [followPending, setFollowPending] = useState(false);
  const shouldRedirectToDefaultForum = forums.length > 0 && !selectedForum;

  const applyComposerDraft = useCallback((draft) => {
    if (!draft) {
      return;
    }

    setForm({
      title: String(draft.title || ''),
      content: String(draft.content || ''),
      forumId: String(draft.forumId || selectedForumOption?.id || ''),
      section: String(draft.section || getScopedDefaultSection(selectedForumOption, forums)) || getScopedDefaultSection(selectedForumOption, forums),
      tags: Array.isArray(draft.tags) ? draft.tags.join(', ') : String(draft.tags || '')
    });
    setMessage('');
    setIsComposerOpen(true);
  }, [forums, selectedForumOption]);

  const sectionCounts = useMemo(() => {
    const counts = {};
    for (const post of posts) {
      const key = post.section || fallbackSectionValue;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [fallbackSectionValue, posts]);

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
  }, [applyComposerDraft, currentUser, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onLoadPosts({
        q: deferredSearchQuery.trim(),
        forum: selectedForumSlug,
        section: selectedSections,
        page: 1,
        pageSize: 'all'
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deferredSearchQuery, onLoadPosts, selectedForumSlug, selectedSections]);

  useEffect(() => {
    if (!selectedForumOption) {
      return;
    }

    setForm((current) => {
      const nextForumId = current.forumId || selectedForumOption.id;
      const activeForum = forums.find((forum) => forum.id === nextForumId) || selectedForumOption;
      const nextSection = activeForum.sectionScope.includes(current.section)
        ? current.section
        : getScopedDefaultSection(activeForum, forums);

      if (current.forumId === nextForumId && current.section === nextSection) {
        return current;
      }

      return {
        ...current,
        forumId: nextForumId,
        section: nextSection
      };
    });
  }, [forums, selectedForumOption]);

  useEffect(() => {
    setSectionScopeCommitted(selectedForum?.sectionScope || []);
    setSectionScopeDraft(selectedForum?.sectionScope || []);
    setSectionDraft('');
    setSectionEditMode(false);
    setSectionNotice({ type: '', text: '' });
  }, [selectedForum?.id, selectedForum?.sectionScope]);

  useEffect(() => {
    if (visibleSectionValues.length === 0) {
      return;
    }
    setSelectedSections((current) => current.filter((value) => visibleSectionValues.includes(value)));
  }, [visibleSectionValues]);

  const toggleSection = (sectionValue) => {
    setSelectedSections((current) =>
      current.includes(sectionValue)
        ? current.filter((value) => value !== sectionValue)
        : [...current, sectionValue]
    );
  };

  const clearSections = () => {
    setSelectedSections([]);
  };

  const canManageForumSections = Boolean(
    currentUser && selectedForum && (currentUser.isAdmin || selectedForum.ownerId === currentUser.id)
  );

  const mergeSectionIntoScope = useCallback((currentScope, sectionValue) => {
    if (!sectionValue || currentScope.includes(sectionValue)) {
      return currentScope;
    }

    const nextDraftValues = new Set([...currentScope, sectionValue]);
    const nextPersistedValues = persistedSectionScope.filter((value) => nextDraftValues.has(value));
    const nextCustomValues = currentScope.filter((value) => !persistedSectionScope.includes(value));

    if (!persistedSectionScope.includes(sectionValue)) {
      nextCustomValues.push(sectionValue);
    }

    return [...nextPersistedValues, ...nextCustomValues];
  }, [persistedSectionScope]);

  const restoreSectionIntoDraft = useCallback((sectionValue) => {
    setSectionScopeDraft((current) => mergeSectionIntoScope(current, sectionValue));
  }, [mergeSectionIntoScope]);

  const sectionItems = useMemo(
    () => visibleSections.map((item) => {
      const isPersisted = persistedSectionScope.includes(item.value);
      const isInDraft = sectionScopeDraft.includes(item.value);

      return {
        ...item,
        isPendingRemoval: sectionEditMode && isPersisted && !isInDraft,
        isPendingAdd: sectionEditMode && !isPersisted && isInDraft
      };
    }),
    [persistedSectionScope, sectionEditMode, sectionScopeDraft, visibleSections]
  );

  const persistForumSections = async (nextSectionScope, successMessage) => {
    if (!selectedForum?.id) {
      return;
    }

    setSectionUpdatePending(true);
    setSectionNotice({ type: '', text: '' });
    const result = await onUpdateForumSections(selectedForum.id, nextSectionScope);
    if (!result.ok) {
      setSectionNotice({ type: 'error', text: result.message || 'Failed to update forum sections.' });
      setSectionUpdatePending(false);
      return;
    }

    setSectionScopeCommitted(nextSectionScope);
    setSectionScopeDraft(nextSectionScope);
    setSectionDraft('');
    setSectionNotice({ type: 'success', text: successMessage });
    setSectionEditMode(false);
    setSectionUpdatePending(false);
  };

  const addForumSection = () => {
    const normalizedSection = normalizeSectionInput(sectionDraft);
    if (!normalizedSection) {
      setSectionNotice({ type: 'error', text: 'Enter a section name first.' });
      return;
    }
    if (sectionScopeDraft.includes(normalizedSection)) {
      setSectionNotice({ type: 'error', text: 'That section already exists in this forum.' });
      return;
    }
    if (persistedSectionScope.includes(normalizedSection)) {
      restoreSectionIntoDraft(normalizedSection);
      setSectionDraft('');
      setSectionNotice({ type: '', text: '' });
      return;
    }

    setSectionScopeDraft((current) => mergeSectionIntoScope(current, normalizedSection));
    setSectionDraft('');
    setSectionNotice({ type: '', text: '' });
  };

  const markSectionForRemoval = (sectionValue) => {
    if (!sectionEditMode) {
      return;
    }

    if (!sectionScopeDraft.includes(sectionValue)) {
      restoreSectionIntoDraft(sectionValue);
      setSectionNotice({ type: '', text: '' });
      return;
    }

    if ((sectionScopeDraft || []).length <= 1) {
      setSectionNotice({ type: 'error', text: 'A forum must keep at least one section.' });
      return;
    }

    setSectionScopeDraft((current) => current.filter((value) => value !== sectionValue));
    setSectionNotice({ type: '', text: '' });
  };

  const cancelSectionChanges = () => {
    setSectionScopeDraft(selectedForum?.sectionScope || []);
    setSectionDraft('');
    setSectionEditMode(false);
    setSectionNotice({ type: '', text: '' });
  };

  const saveSectionChanges = async () => {
    const pendingSectionValue = normalizeSectionInput(sectionDraft);
    if (sectionDraft.trim() && !pendingSectionValue) {
      setSectionNotice({ type: 'error', text: 'Enter letters or numbers for the section name.' });
      return;
    }

    const nextSectionScope = pendingSectionValue
      ? mergeSectionIntoScope(sectionScopeDraft, pendingSectionValue)
      : sectionScopeDraft;

    if (JSON.stringify(nextSectionScope) === JSON.stringify(selectedForum?.sectionScope || [])) {
      setSectionDraft('');
      setSectionEditMode(false);
      return;
    }

    await persistForumSections(nextSectionScope, 'Forum sections saved.');
  };

  const isFollowingSelectedForum = Boolean(currentUser && selectedForum?.isFollowing);

  const toggleForumFollow = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const token = authStorage.getToken();
    if (!token || !selectedForum?.id) {
      navigate('/login');
      return;
    }

    setFollowPending(true);
    setMessage('');
    try {
      if (isFollowingSelectedForum) {
        await apiUnfollowForum(selectedForum.id, token);
      } else {
        await apiFollowForum(selectedForum.id, token);
      }
      await onLoadForums();
      setMessage(isFollowingSelectedForum ? 'Forum removed from your account shortcuts.' : 'Forum saved to your account shortcuts.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update forum follow.');
    } finally {
      setFollowPending(false);
    }
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
    setForm({
      title: '',
      content: '',
      forumId: selectedForumOption?.id || '',
      section: getScopedDefaultSection(selectedForumOption, forums),
      tags: ''
    });
    setSearchQuery('');
    setSelectedSections([]);
    await Promise.all([
      onLoadPosts({ q: '', forum: selectedForumSlug, section: [], page: 1, pageSize: 'all' }),
      onLoadForums()
    ]);
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

  const moderatePost = async (post) => {
    const forumId = post.forum?.id;
    if (!forumId) {
      setMessage('This post is not attached to a forum yet.');
      return;
    }

    const reason = window.prompt('Why are you removing this post from the forum?', 'Needs review');
    if (!reason || !reason.trim()) {
      return;
    }

    const result = await onOwnerRemovePost(forumId, post.id, reason.trim());
    setMessage(result.message || (result.ok ? 'Post removed.' : 'Failed to remove post.'));
  };

  const activeForumForComposer = forums.find((forum) => forum.id === form.forumId) || selectedForumOption;
  const activeSectionOptions = buildSectionOptionsForForum(activeForumForComposer);
  const canManagePost = (post) => Boolean(
    currentUser && post.forum?.ownerId && (currentUser.isAdmin || post.forum.ownerId === currentUser.id)
  );

  if (shouldRedirectToDefaultForum) {
    return <Navigate to={`/forum/${forums[0].slug}`} replace />;
  }

  return (
    <div className="container page-shell">
      <section className="hero-card mb-4">
        <div className="forum-hero-row">
          <div>
            <h1 className="hero-title">{selectedForum?.name || 'Forum'}</h1>
            <p className="hero-copy mb-0">
              {selectedForum?.description || 'Browse posts, discussions, and practical writeups from this forum only.'}
            </p>
          </div>
          {selectedForum && (
            currentUser ? (
              <button
                type="button"
                className={isFollowingSelectedForum ? 'forum-secondary-btn' : 'forum-primary-btn'}
                onClick={toggleForumFollow}
                disabled={followPending}
              >
                {followPending ? 'Updating...' : isFollowingSelectedForum ? 'Unfollow Forum' : 'Follow Forum'}
              </button>
            ) : (
              <Link to="/login" className="forum-secondary-btn text-decoration-none">
                Login to Follow
              </Link>
            )
          )}
        </div>
      </section>

      <div className="forum-workspace-float">
        <div id="forum-workspace-panel" className="forum-workspace-panel">
          <ForumSidebar
            currentUser={currentUser}
            forums={forums}
            currentForum={selectedForum}
          />
        </div>
      </div>

      <div className="forum-layout">
        <div className="forum-main forum-main-full">
          <section className="panel mb-4">
            <div className="forum-sections-head mb-3">
              <div>
                <h3 className="mb-1 type-title-md">Sections</h3>
                <p className="type-body mb-0">
                  {canManageForumSections
                    ? 'Filter posts here, and manage which sections this forum accepts.'
                    : 'Filter posts in this forum by section.'}
                </p>
              </div>
              <div className="forum-sections-head-actions">
                <span className="muted">{sectionDisplayScope.length || 0} sections</span>
                {canManageForumSections && !sectionEditMode && (
                  <button
                    type="button"
                    className="forum-secondary-btn"
                    onClick={() => setSectionEditMode(true)}
                    disabled={sectionUpdatePending}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {sectionNotice.text && (
              <div className={`settings-alert ${sectionNotice.type === 'error' ? 'is-error' : 'is-success'} mb-3`}>
                {sectionNotice.text}
              </div>
            )}

            {canManageForumSections && sectionEditMode && (
              <div className="forum-section-admin mb-3">
                <div className="forum-section-admin-copy">
                  <strong>Manage Sections</strong>
                  <span className="muted">Type a new section, then click the floating x on any section you want to remove.</span>
                </div>
                <div className="forum-section-admin-controls">
                  <input
                    className="form-control forum-input forum-section-input"
                    value={sectionDraft}
                    onChange={(event) => setSectionDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addForumSection();
                      }
                    }}
                    placeholder="Type a section name"
                    disabled={sectionUpdatePending}
                  />
                  <button
                    type="button"
                    className="forum-primary-btn"
                    onClick={addForumSection}
                    disabled={sectionUpdatePending}
                  >
                    Add Section
                  </button>
                </div>
              </div>
            )}

            <div className="section-grid">
              <div className="section-card is-open">
                <div className="section-chip-wrap">
                  {sectionItems.map((item) => (
                    <div
                      key={item.value}
                      className={`section-chip-row ${sectionEditMode && canManageForumSections ? 'is-editing' : ''} ${item.isPendingRemoval ? 'is-pending-remove' : ''} ${item.isPendingAdd ? 'is-pending-add' : ''}`.trim()}
                    >
                      <button
                        type="button"
                        className={`section-chip ${selectedSections.includes(item.value) ? 'is-active' : ''}`}
                        onClick={() => toggleSection(item.value)}
                      >
                        <span>{item.label}</span>
                        <span className="section-count">{sectionCounts[item.value] || 0}</span>
                      </button>
                      {canManageForumSections && (
                        <button
                          type="button"
                          className="section-chip-remove"
                          onClick={() => markSectionForRemoval(item.value)}
                          disabled={sectionUpdatePending || !sectionEditMode}
                          aria-label={`${item.isPendingRemoval ? 'Restore' : 'Remove'} ${item.label}`}
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {canManageForumSections && sectionEditMode && (
              <div className="forum-section-admin-actions mt-3">
                <button
                  type="button"
                  className="forum-primary-btn"
                  onClick={saveSectionChanges}
                  disabled={sectionUpdatePending}
                >
                  {sectionUpdatePending ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="forum-secondary-btn"
                  onClick={cancelSectionChanges}
                  disabled={sectionUpdatePending}
                >
                  Cancel
                </button>
              </div>
            )}

            {selectedSections.length > 0 && (
              <div className="section-filter-row mt-3">
                <button
                  type="button"
                  className="section-filter is-active"
                  onClick={clearSections}
                >
                  Clear Sections
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
                placeholder="Search title, content, tags, author, section"
              />
              {searchQuery && (
                <button type="button" className="forum-secondary-btn" onClick={() => setSearchQuery('')}>
                  Clear Search
                </button>
              )}
            </div>

            {message && <div className="settings-alert is-success mb-3">{message}</div>}
            {loadingPosts && <p className="muted mb-3">Refreshing posts...</p>}

            <div className="forum-feed">
              {posts.map((post) => (
                <article key={post.id} className="forum-post-card">
                  <div className="forum-post-meta-row">
                    <div className="forum-post-badges">
                      {post.forum?.name && <span className="forum-tag is-active">{post.forum.name}</span>}
                      <span className="forum-tag">{getSectionLabel(post.section)}</span>
                    </div>
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
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {canManagePost(post) && (
                        <button type="button" className="forum-danger-btn" onClick={() => moderatePost(post)}>
                          Remove
                        </button>
                      )}
                      <Link to={`/forum/post/${post.id}`} className="post-read-link">
                        Read more
                      </Link>
                    </div>
                  </div>
                </article>
              ))}

              {!loadingPosts && posts.length === 0 && (
                <p className="muted mb-0">No posts match the current forum, section, and tag filters.</p>
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
                <label className="form-label">Forum</label>
                <div className="form-control forum-input d-flex align-items-center">
                  {selectedForum?.name || 'Current forum'}
                </div>
              </div>

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
                  options={activeSectionOptions.length > 0 ? activeSectionOptions : globalSectionOptions}
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
