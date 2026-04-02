import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MDEditor, { commands as mdCommands } from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { apiFollowForum, apiUnfollowForum } from '../api';
import Select from '../components/Select';
import { authStorage } from '../lib/authStorage';
import {
  buildForumDirectory,
  getFeedScore,
  getPostActivityAt,
  sortByPopularity,
  sortByRecentActivity
} from '../lib/forumInsights';
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

const AI_REWRITE_PRESETS = [
  {
    id: 'polish',
    label: 'Polish',
    instruction: 'Polish this draft for clarity and flow while preserving my original meaning and voice.'
  },
  {
    id: 'shorter',
    label: 'Shorter',
    instruction: 'Make this draft shorter and tighter while keeping the key ideas and examples.'
  },
  {
    id: 'stronger',
    label: 'More Technical',
    instruction: 'Make this draft more technical and concrete with sharper implementation detail.'
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
  onAiRewritePostDraft,
  onUpdateForumSections,
  onOwnerRemovePost
}) {
  void onUpdateForumSections;
  const location = useLocation();
  const navigate = useNavigate();
  const { sectionId, forumSlug } = useParams();
  const [searchParams] = useSearchParams();
  const selectedForumSlug = String(forumSlug || '').trim().toLowerCase();
  const selectedForum = useMemo(
    () => forums.find((forum) => forum.slug === selectedForumSlug) || null,
    [forums, selectedForumSlug]
  );
  const isAggregateView = !selectedForumSlug;
  const activeSectionSource = selectedForum?.sectionScope || forums;
  const availableSectionValues = useMemo(() => getSectionValues(activeSectionSource), [activeSectionSource]);
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
  const persistedSectionScope = useMemo(() => sectionScopeCommitted, [sectionScopeCommitted]);
  const sectionDisplayScope = useMemo(() => persistedSectionScope, [persistedSectionScope]);
  const visibleSections = useMemo(() => getSectionOptions(sectionDisplayScope), [sectionDisplayScope]);
  const visibleSectionValues = useMemo(() => visibleSections.map((item) => item.value), [visibleSections]);
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
  const [composerAiOpen, setComposerAiOpen] = useState(false);
  const [composerAiInstruction, setComposerAiInstruction] = useState('');
  const [composerAiMessage, setComposerAiMessage] = useState('');
  const [composerAiLoading, setComposerAiLoading] = useState(false);
  const [composerAiAbortController, setComposerAiAbortController] = useState(null);
  const [followPending, setFollowPending] = useState(false);

  const forumDirectory = useMemo(() => buildForumDirectory(forums, posts), [forums, posts]);

  const forumInsightMap = useMemo(() => {
    const nextMap = new Map();
    for (const forum of forumDirectory) {
      if (forum.id) {
        nextMap.set(forum.id, forum);
      }
      if (forum.slug) {
        nextMap.set(forum.slug, forum);
      }
    }
    return nextMap;
  }, [forumDirectory]);

  const preferredComposerForum = useMemo(() => {
    if (selectedForumOption) {
      return selectedForumOption;
    }

    const followed = [...forums]
      .filter((forum) => forum.isFollowing)
      .sort((a, b) => {
        const aInsight = forumInsightMap.get(a.id) || forumInsightMap.get(a.slug) || {};
        const bInsight = forumInsightMap.get(b.id) || forumInsightMap.get(b.slug) || {};
        return sortByRecentActivity(aInsight, bInsight);
      })[0];

    return followed || [...forums].sort((a, b) => {
      const aInsight = forumInsightMap.get(a.id) || forumInsightMap.get(a.slug) || {};
      const bInsight = forumInsightMap.get(b.id) || forumInsightMap.get(b.slug) || {};
      return sortByPopularity(aInsight, bInsight);
    })[0] || null;
  }, [forumInsightMap, forums, selectedForumOption]);

  const applyComposerDraft = useCallback((draft) => {
    if (!draft) {
      return;
    }

    const draftForum = forums.find((forum) => forum.id === draft.forumId)
      || selectedForumOption
      || preferredComposerForum;
    const defaultSection = getScopedDefaultSection(draftForum, forums);

    setForm({
      title: String(draft.title || ''),
      content: String(draft.content || ''),
      forumId: String(draft.forumId || draftForum?.id || ''),
      section: String(draft.section || defaultSection) || defaultSection,
      tags: Array.isArray(draft.tags) ? draft.tags.join(', ') : String(draft.tags || '')
    });
    setMessage('');
    setIsComposerOpen(true);
  }, [forums, preferredComposerForum, selectedForumOption]);

  const displayedPosts = useMemo(() => {
    if (!isAggregateView) {
      return posts;
    }

    const now = Date.now();
    return [...posts].sort((a, b) => {
      const aInsight = forumInsightMap.get(a.forum?.id || '') || forumInsightMap.get(a.forum?.slug || '') || null;
      const bInsight = forumInsightMap.get(b.forum?.id || '') || forumInsightMap.get(b.forum?.slug || '') || null;
      const scoreDiff = getFeedScore(b, bInsight, now) - getFeedScore(a, aInsight, now);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return getPostActivityAt(b) - getPostActivityAt(a);
    });
  }, [forumInsightMap, isAggregateView, posts]);

  const sectionCounts = useMemo(() => {
    const counts = {};
    for (const post of displayedPosts) {
      const key = post.section || fallbackSectionValue;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [displayedPosts, fallbackSectionValue]);

  const sortedComposerForums = useMemo(() => {
    return [...forums].sort((a, b) => {
      const aInsight = forumInsightMap.get(a.id) || forumInsightMap.get(a.slug) || {};
      const bInsight = forumInsightMap.get(b.id) || forumInsightMap.get(b.slug) || {};

      return Number(Boolean(b.isFollowing)) - Number(Boolean(a.isFollowing))
        || sortByRecentActivity(aInsight, bInsight);
    });
  }, [forumInsightMap, forums]);

  const forumComposerOptions = useMemo(() => {
    const followedOptions = sortedComposerForums
      .filter((forum) => forum.isFollowing)
      .map((forum) => ({ value: forum.id, label: forum.name }));
    const otherOptions = sortedComposerForums
      .filter((forum) => !forum.isFollowing)
      .map((forum) => ({ value: forum.id, label: forum.name }));

    if (followedOptions.length > 0 && otherOptions.length > 0) {
      return [
        { label: 'Followed Forums', options: followedOptions },
        { label: 'All Forums', options: otherOptions }
      ];
    }

    return [
      {
        label: 'Forums',
        options: sortedComposerForums.map((forum) => ({ value: forum.id, label: forum.name }))
      }
    ];
  }, [sortedComposerForums]);

  const followedForumOptions = useMemo(() => {
    const followedForums = [...forums]
      .filter((forum) => forum.isFollowing)
      .sort((a, b) => {
        const aInsight = forumInsightMap.get(a.id) || forumInsightMap.get(a.slug) || {};
        const bInsight = forumInsightMap.get(b.id) || forumInsightMap.get(b.slug) || {};
        return sortByRecentActivity(aInsight, bInsight);
      });

    const options = [
      { value: '__all__', label: 'All Forums' }
    ];

    if (followedForums.length > 0) {
      options.push({
        label: 'Subscribed Forums',
        options: followedForums.map((forum) => ({
          value: forum.slug,
          label: forum.name
        }))
      });
    }

    return options;
  }, [forumInsightMap, forums]);

  const selectedFeedSwitcherValue = useMemo(() => {
    if (isAggregateView) {
      return '__all__';
    }
    if (selectedForum?.isFollowing) {
      return selectedForum.slug;
    }
    return '';
  }, [isAggregateView, selectedForum]);

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
    const defaultForum = selectedForumOption || preferredComposerForum;
    if (!defaultForum) {
      return;
    }

    setForm((current) => {
      const nextForumId = selectedForumOption ? selectedForumOption.id : (current.forumId || defaultForum.id);
      const activeForum = forums.find((forum) => forum.id === nextForumId) || defaultForum;
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
  }, [forums, preferredComposerForum, selectedForumOption]);

  useEffect(() => {
    const nextScope = selectedForum?.sectionScope || availableSectionValues;
    setSectionScopeCommitted(nextScope);
  }, [availableSectionValues, selectedForum?.id, selectedForum?.sectionScope]);

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

  const selectedForumPermissions = selectedForum?.currentUserPermissions || [];
  const canViewForumFollowers = Boolean(
    currentUser && selectedForum && (
      currentUser.isAdmin
      || selectedForum.ownerId === currentUser.id
      || selectedForumPermissions.includes('view_followers')
    )
  );

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
      setMessage(isFollowingSelectedForum ? 'Forum removed from your saved forums.' : 'Forum saved to your forums.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update forum follow.');
    } finally {
      setFollowPending(false);
    }
  };

  const submitPost = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!form.forumId) {
      setMessage('Choose a forum first.');
      return;
    }

    if (!form.title.trim() || !form.content.trim()) {
      setMessage('Title and content are required.');
      return;
    }

    const result = await onCreatePost(form);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const resetForum = selectedForumOption || preferredComposerForum;
    setForm({
      title: '',
      content: '',
      forumId: resetForum?.id || '',
      section: getScopedDefaultSection(resetForum, forums),
      tags: ''
    });
    setComposerAiOpen(false);
    setComposerAiInstruction('');
    setComposerAiMessage('');
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

  const stopComposerAiRewrite = useCallback(() => {
    composerAiAbortController?.abort();
    setComposerAiAbortController(null);
    setComposerAiLoading(false);
  }, [composerAiAbortController]);

  const closeComposer = useCallback(() => {
    stopComposerAiRewrite();
    setComposerAiOpen(false);
    setComposerAiInstruction('');
    setComposerAiMessage('');
    setIsComposerOpen(false);
  }, [stopComposerAiRewrite]);

  const runComposerAiRewrite = useCallback(async (instructionOverride) => {
    const instruction = String(instructionOverride || composerAiInstruction).trim();
    if (!instruction) {
      setMessage('Add a rewrite instruction first.');
      return;
    }

    if (!form.title.trim()) {
      setMessage('Add a draft title before using AI.');
      return;
    }

    if (!form.content.trim()) {
      setMessage('Add some draft content before using AI.');
      return;
    }

    setMessage('');
    setComposerAiMessage('');
    setComposerAiLoading(true);
    const controller = new AbortController();
    setComposerAiAbortController(controller);
    const result = await onAiRewritePostDraft({
      instruction,
      draft: {
        title: form.title,
        content: form.content,
        section: form.section,
        forumId: form.forumId,
        tags: form.tags
      }
    }, controller.signal);
    setComposerAiAbortController(null);
    setComposerAiLoading(false);

    if (!result.ok) {
      if (result.message === 'Request cancelled.') {
        setComposerAiMessage('AI draft rewrite stopped.');
        return;
      }
      setMessage(result.message || 'Failed to rewrite draft with AI.');
      return;
    }

    const rewrittenDraft = result.data?.draft;
    if (!rewrittenDraft) {
      setMessage('AI rewrite did not return a draft.');
      return;
    }

    setForm((current) => ({
      ...current,
      title: rewrittenDraft.title || current.title,
      content: rewrittenDraft.content || current.content,
      section: rewrittenDraft.section || current.section,
      tags: Array.isArray(rewrittenDraft.tags) ? rewrittenDraft.tags.join(', ') : current.tags
    }));
    setComposerAiMessage(result.data?.generation?.rationale || 'AI rewrite applied to the draft. Review it, then publish when you are ready.');
  }, [composerAiInstruction, form, onAiRewritePostDraft]);

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

  const switchForumFeed = (nextValue) => {
    if (!nextValue || nextValue === selectedFeedSwitcherValue) {
      return;
    }

    if (nextValue === '__all__') {
      navigate('/forum');
      return;
    }

    navigate(`/forum/${nextValue}`);
  };

  const activeForumForComposer = selectedForumOption || forums.find((forum) => forum.id === form.forumId) || preferredComposerForum;
  const activeSectionOptions = buildSectionOptionsForForum(activeForumForComposer);
  const showComposerCodeTools = Boolean(activeForumForComposer?.showCodeBlockTools ?? true);
  const composerToolbarCommands = useMemo(() => {
    if (showComposerCodeTools) {
      return undefined;
    }

    return mdCommands.getCommands().filter((command) => !['code', 'codeBlock'].includes(command?.name || command?.keyCommand || ''));
  }, [showComposerCodeTools]);
  const canSiteModerate = Boolean(currentUser?.isAdmin || currentUser?.adminPermissions?.includes('moderation'));
  const canManagePost = (post) => {
    if (!currentUser || !post.forum?.id) {
      return false;
    }

    const forumDetails = forums.find((forum) => forum.id === post.forum.id) || post.forum;
    return Boolean(
      canSiteModerate
      || (forumDetails?.ownerId && forumDetails.ownerId === currentUser.id)
      || (forumDetails?.currentUserPermissions || []).includes('moderate_posts')
    );
  };

  if (selectedForumSlug && forums.length > 0 && !selectedForum) {
    return <Navigate to="/forum" replace />;
  }

  return (
    <div className="container page-shell">
      <section className="panel mb-4 forum-view-intro">
        <div className="forum-view-intro-row">
          <div className="forum-view-intro-main">
            <div className="forum-view-intro-copy-block">
              <p className="type-kicker mb-1">{isAggregateView ? 'Forum Feed' : 'Forum'}</p>
              <h3 className="mb-1 type-title-md">
                {isAggregateView ? 'All forums, one smart feed' : selectedForum?.name || 'Forum'}
              </h3>
              <p className="forum-view-intro-copy mb-0">
                {isAggregateView
                  ? 'Posts here are prioritized by the forums you follow, recent updates, and overall forum activity.'
                  : (selectedForum?.description || 'Browse posts and practical writeups from this forum.')}
              </p>
              {isAggregateView && (
                <div className="forum-view-intro-meta-row">
                  <span className="forum-view-intro-badge">
                    <strong>{forums.length}</strong>
                    <span>Forums in feed</span>
                  </span>
                </div>
              )}
            </div>

            {selectedForum && (
              <div className="forum-view-intro-stats">
                <>
                  <span className="forum-view-intro-stat">
                    <strong>{selectedForum.followerCount ?? 0}</strong>
                    <span>Followers</span>
                  </span>
                  <span className="forum-view-intro-stat">
                    <strong>{selectedForum.livePostCount ?? selectedForum.postCount ?? 0}</strong>
                    <span>Posts</span>
                  </span>
                </>
              </div>
            )}
          </div>
          <div className="forum-view-intro-actions">
            <Link to="/explore" className="explore-intro-link text-decoration-none">
              <span className="explore-intro-link-kicker">Discover</span>
              <strong>Explore</strong>
              <span className="explore-intro-link-copy">Browse more forums and trending spaces.</span>
              <span className="explore-intro-link-footer">
                <span>Forum directory</span>
                <span className="explore-intro-link-arrow" aria-hidden="true">↗</span>
              </span>
            </Link>
            {currentUser && followedForumOptions.length > 1 && (
              <div className="forum-feed-switcher">
                <Select
                  options={followedForumOptions}
                  value={selectedFeedSwitcherValue}
                  onChange={switchForumFeed}
                  placeholder="Subscribed forums"
                  triggerClassName="forum-feed-switcher-trigger"
                  menuClassName="forum-feed-switcher-menu"
                />
              </div>
            )}
            {selectedForum && (
              <div className="forum-view-intro-action-row">
                {canViewForumFollowers && (
                  <Link
                    to={`/forum/${selectedForum.slug}/followers`}
                    className="forum-secondary-btn forum-intro-btn text-decoration-none"
                  >
                    View Followers
                  </Link>
                )}
                {currentUser ? (
                  <button
                    type="button"
                    className={`${isFollowingSelectedForum ? 'forum-secondary-btn' : 'forum-primary-btn'} forum-intro-btn`.trim()}
                    onClick={toggleForumFollow}
                    disabled={followPending}
                  >
                    {followPending ? 'Updating...' : isFollowingSelectedForum ? 'Unfollow Forum' : 'Follow Forum'}
                  </button>
                ) : (
                  <Link to="/login" className="forum-secondary-btn forum-intro-btn text-decoration-none">
                    Login to Follow
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="forum-layout">
        <div className="forum-main forum-main-full">
          {!isAggregateView && (
            <section className="panel mb-4">
              <div className="forum-sections-head mb-3">
                <div>
                  <h3 className="mb-1 type-title-md">Sections</h3>
                  <p className="type-body mb-0">Filter posts in this forum by section.</p>
                </div>
                <div className="forum-sections-head-actions">
                  <span className="muted">{sectionDisplayScope.length || 0} sections</span>
                </div>
              </div>

              <div className="section-grid">
                <div className="section-card is-open">
                  <div className="section-chip-wrap">
                    {visibleSections.map((item) => (
                      <div
                        key={item.value}
                        className="section-chip-row"
                      >
                        <button
                          type="button"
                          className={`section-chip ${selectedSections.includes(item.value) ? 'is-active' : ''}`.trim()}
                          onClick={() => toggleSection(item.value)}
                        >
                          <span>{item.label}</span>
                          <span className="section-count">{sectionCounts[item.value] || 0}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

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
          )}

          <section className="panel">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <div>
                <h3 className="mb-1 type-title-md">{isAggregateView ? 'Smart Feed' : 'Forum Posts'}</h3>
                <p className="muted mb-0">
                  {isAggregateView
                    ? 'Forum label lives on the top-left of every post so users always know where it came from.'
                    : 'Posts inside this forum, ordered by your current filters.'}
                </p>
              </div>
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
                placeholder={isAggregateView ? 'Search posts across all forums' : 'Search title, content, tags, author, section'}
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
              {displayedPosts.map((post) => (
                <article key={post.id} className="forum-post-card">
                  <div className="forum-post-meta-row">
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
                    <span className="muted forum-time">{formatTime(getPostActivityAt(post))}</span>
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
                          className={`post-tag-pill ${searchQuery === tag ? 'is-active' : ''}`.trim()}
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

              {!loadingPosts && displayedPosts.length === 0 && (
                <p className="muted mb-0">No posts match the current forum, section, and tag filters.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {isComposerOpen && currentUser && (
        <div className="forum-modal-backdrop" onClick={closeComposer}>
          <section className="forum-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h3 className="mb-1">Create a Post</h3>
                <p className="muted mb-0">Posting as {currentUser.name}</p>
              </div>
              <button type="button" className="forum-close-btn" onClick={closeComposer}>Close</button>
            </div>

            <form onSubmit={submitPost} className="forum-form">
              <div className="mb-3">
                <label className="form-label">Forum</label>
                {selectedForum ? (
                  <div className="form-control forum-input d-flex align-items-center">
                    {selectedForum.name}
                  </div>
                ) : (
                  <Select
                    options={forumComposerOptions}
                    value={form.forumId}
                    onChange={(nextForumId) => {
                      const nextForum = forums.find((forum) => forum.id === nextForumId) || preferredComposerForum;
                      setForm((prev) => ({
                        ...prev,
                        forumId: nextForumId,
                        section: getScopedDefaultSection(nextForum, forums)
                      }));
                    }}
                    placeholder="Choose a forum"
                  />
                )}
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
                {showComposerCodeTools && (
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
                )}
                <div data-color-mode="dark" className="markdown-editor-shell">
                  <MDEditor
                    value={form.content}
                    onChange={(value) => setForm((prev) => ({ ...prev, content: value || '' }))}
                    preview="edit"
                    commands={composerToolbarCommands}
                    height={320}
                    textareaProps={{
                      placeholder: 'Share the idea, code approach, and why it worked.'
                    }}
                  />
                </div>
                <div className="form-help">
                  {showComposerCodeTools
                    ? 'Choose a language, insert a code block, then paste your code inside it.'
                    : 'This forum keeps the composer simple, so the code block shortcut is hidden.'}
                </div>
              </div>

              <section className="settings-card mb-3">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <div>
                    <h4 className="mb-1">AI Draft</h4>
                    <p className="muted mb-0">Use AI on this unpublished draft before you publish it.</p>
                  </div>
                  <button
                    type="button"
                    className="forum-secondary-btn"
                    onClick={() => setComposerAiOpen((current) => !current)}
                  >
                    {composerAiOpen ? 'Hide AI Draft' : 'Open AI Draft'}
                  </button>
                </div>

                {composerAiOpen && (
                  <>
                    <div className="forum-actions mb-3">
                      {AI_REWRITE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className="forum-secondary-btn"
                          disabled={composerAiLoading}
                          onClick={() => {
                            setComposerAiInstruction(preset.instruction);
                            runComposerAiRewrite(preset.instruction);
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
                      value={composerAiInstruction}
                      onChange={(event) => setComposerAiInstruction(event.target.value)}
                      placeholder="Example: tighten the intro, keep the technical details, and make the conclusion more actionable."
                    />
                    <div className="forum-actions mt-3">
                      {composerAiLoading && (
                        <button
                          type="button"
                          className="forum-secondary-btn"
                          onClick={stopComposerAiRewrite}
                        >
                          Stop
                        </button>
                      )}
                      <button
                        type="button"
                        className="forum-primary-btn"
                        disabled={composerAiLoading}
                        onClick={() => runComposerAiRewrite()}
                      >
                        {composerAiLoading ? 'Rewriting...' : 'Rewrite Draft with AI'}
                      </button>
                    </div>
                    {composerAiMessage && <p className="muted mt-3 mb-0">{composerAiMessage}</p>}
                  </>
                )}
              </section>

              {message && <p className="mt-3 mb-0 muted">{message}</p>}

              <div className="forum-actions mt-4">
                <button type="submit" className="forum-primary-btn">Publish</button>
                <button type="button" className="forum-secondary-btn" onClick={closeComposer}>Cancel</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
