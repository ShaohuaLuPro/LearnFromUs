import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MDEditor, { commands as mdCommands } from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { apiDeleteMediaAsset, apiFollowForum, apiUnfollowForum, apiUploadMediaFile, buildMediaToken, resolveMediaSource } from '../api';
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

const FEED_SORT_OPTIONS = [
  { value: 'best', label: 'Best' },
  { value: 'hot', label: 'Hot' },
  { value: 'new', label: 'New' },
  { value: 'top', label: 'Top' },
  { value: 'rising', label: 'Rising' }
];

const FEED_TIME_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '1d', label: 'Past 1 day' },
  { value: '3d', label: 'Past 3 days' },
  { value: '7d', label: 'Past 7 days' },
  { value: '15d', label: 'Past 15 days' },
  { value: '30d', label: 'Past 30 days' }
];

function getSparseFeedThreshold(viewportWidth) {
  if (viewportWidth >= 1280) {
    return 4;
  }
  if (viewportWidth >= 768) {
    return 3;
  }
  return 2;
}

function getOptionLabel(options, value, fallback = '') {
  return options.find((option) => option.value === value)?.label || fallback;
}

function renderNativeSelectOptions(options) {
  return options.map((item) => {
    if (Array.isArray(item.options)) {
      return (
        <optgroup key={item.label} label={item.label}>
          {item.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      );
    }

    return (
      <option key={item.value} value={item.value}>
        {item.label}
      </option>
    );
  });
}

function getPostCoverImage(content) {
  const markdownMatch = String(content || '').match(/!\[[^\]]*]\((\S+?)(?:\s+["'][^"']*["'])?\)/i);
  if (markdownMatch?.[1]) {
    return resolveMediaSource(markdownMatch[1].replace(/^<|>$/g, '').trim());
  }

  const htmlMatch = String(content || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlMatch?.[1]) {
    return resolveMediaSource(htmlMatch[1].trim());
  }

  return '';
}

function getTextCardPreview(content) {
  const plainText = String(content || '')
    .replace(/!\[[^\]]*]\((.*?)\)/g, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#>*_[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= 150) {
    return plainText;
  }

  return `${plainText.slice(0, 150).trimEnd()}...`;
}

function getAuthorInitial(name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    return 'T';
  }
  return cleanName.slice(0, 1).toUpperCase();
}

function buildImageMarkdown(fileName, assetId) {
  const altText = String(fileName || 'uploaded image')
    .replace(/\.[^./\\]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim() || 'uploaded image';
  return `\n![${altText}](${buildMediaToken(assetId)})\n`;
}

function getUnusedUploadedAssets(uploadedAssets, content) {
  const draftContent = String(content || '');
  return uploadedAssets.filter((asset) => !draftContent.includes(asset.token));
}

function getScopedDefaultSection(forum, forums) {
  return getDefaultSectionValue(forum?.sectionScope || [], forums);
}

function forumSupportsSection(forum, section) {
  const cleanSection = String(section || '').trim();
  if (!forum) {
    return false;
  }
  if (!cleanSection) {
    return true;
  }
  return !Array.isArray(forum.sectionScope) || forum.sectionScope.length === 0 || forum.sectionScope.includes(cleanSection);
}

function resolveComposerForumForDraft(draft, forums, selectedForumOption, preferredComposerForum) {
  const draftSection = String(draft?.section || '').trim();
  const explicitForum = forums.find((forum) => forum.id === draft?.forumId);
  if (forumSupportsSection(explicitForum, draftSection)) {
    return explicitForum;
  }
  if (forumSupportsSection(selectedForumOption, draftSection)) {
    return selectedForumOption;
  }

  const followedMatch = forums.find((forum) => Boolean(forum.isFollowing) && forumSupportsSection(forum, draftSection));
  if (followedMatch) {
    return followedMatch;
  }

  const anyMatch = forums.find((forum) => forumSupportsSection(forum, draftSection));
  if (anyMatch) {
    return anyMatch;
  }

  return explicitForum || selectedForumOption || preferredComposerForum || null;
}

function getTimeRangeCutoff(rangeValue) {
  const now = Date.now();
  switch (String(rangeValue || 'all')) {
    case '1d':
      return now - 24 * 60 * 60 * 1000;
    case '3d':
      return now - 3 * 24 * 60 * 60 * 1000;
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000;
    case '15d':
      return now - 15 * 24 * 60 * 60 * 1000;
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function getPostViewCount(post) {
  return Number(post?.viewCount || 0);
}

function getPostCommentCount(post) {
  return Number(post?.commentCount || 0);
}

function getTopScore(post) {
  const viewScore = Math.log2(getPostViewCount(post) + 1) * 34;
  const commentScore = Math.log2(getPostCommentCount(post) + 1) * 44;
  return viewScore + commentScore;
}

function getHotScore(post, forumInsight, now, isAggregateView) {
  const activityAt = getPostActivityAt(post);
  const ageHours = Math.max(0, (now - activityAt) / 36e5);
  const recencyScore = Math.max(0, 168 - Math.min(ageHours, 168)) * 2.8;
  const topScore = getTopScore(post);
  const forumScore = isAggregateView
    ? getFeedScore(post, forumInsight, now) * 0.35
    : Math.log2((forumInsight?.livePostCount ?? forumInsight?.postCount ?? 0) + 1) * 20;

  return recencyScore + topScore + forumScore;
}

function getBestScore(post, forumInsight, now, isAggregateView) {
  const activityAt = getPostActivityAt(post);
  const ageHours = Math.max(0, (now - activityAt) / 36e5);
  const qualityScore = getTopScore(post) * 0.75;
  const freshnessScore = Math.max(0, 120 - Math.min(ageHours, 120)) * 1.9;
  const baseFeedScore = isAggregateView
    ? getFeedScore(post, forumInsight, now)
    : getHotScore(post, forumInsight, now, false);

  return baseFeedScore + qualityScore + freshnessScore;
}

function getRisingScore(post, forumInsight, now, isAggregateView) {
  const activityAt = getPostActivityAt(post);
  const ageHours = Math.max(1, (now - activityAt) / 36e5);
  const recentBoost = Math.max(0, 72 - Math.min(ageHours, 72)) * 2.4;
  const engagementVelocity = (getPostViewCount(post) + getPostCommentCount(post) * 4) / Math.pow(ageHours + 2, 0.92);
  const forumBoost = isAggregateView
    ? Math.log2((forumInsight?.livePostCount ?? forumInsight?.postCount ?? 0) + 1) * 6
    : Math.log2((forumInsight?.livePostCount ?? forumInsight?.postCount ?? 0) + 1) * 4;

  return recentBoost + engagementVelocity * 26 + forumBoost;
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
  void pagination;
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
  const defaultSortMode = isAggregateView ? 'best' : 'hot';
  const [selectedSections, setSelectedSections] = useState(sectionId ? [sectionId] : []);
  const [sortMode, setSortMode] = useState(defaultSortMode);
  const [timeRange, setTimeRange] = useState('all');
  const [composerLanguage, setComposerLanguage] = useState('javascript');
  const [composerAiOpen, setComposerAiOpen] = useState(false);
  const [composerAiInstruction, setComposerAiInstruction] = useState('');
  const [composerAiMessage, setComposerAiMessage] = useState('');
  const [composerAiLoading, setComposerAiLoading] = useState(false);
  const [composerAiAbortController, setComposerAiAbortController] = useState(null);
  const [followPending, setFollowPending] = useState(false);
  const [composerUploadMessage, setComposerUploadMessage] = useState('');
  const [composerUploadLoading, setComposerUploadLoading] = useState(false);
  const [composerUploadedAssets, setComposerUploadedAssets] = useState([]);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));
  const composerFileInputRef = useRef(null);

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
  const followedForumCount = useMemo(
    () => forums.filter((forum) => forum.isFollowing).length,
    [forums]
  );
  const activeSortLabel = useMemo(
    () => getOptionLabel(FEED_SORT_OPTIONS, sortMode, 'Best'),
    [sortMode]
  );
  const activeTimeRangeLabel = useMemo(
    () => getOptionLabel(FEED_TIME_RANGE_OPTIONS, timeRange, 'All time'),
    [timeRange]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

    const draftForum = resolveComposerForumForDraft(draft, forums, selectedForumOption, preferredComposerForum);
    const defaultSection = getScopedDefaultSection(draftForum, forums);
    const nextSection = forumSupportsSection(draftForum, draft.section)
      ? String(draft.section || '')
      : defaultSection;

    setForm({
      title: String(draft.title || ''),
      content: String(draft.content || ''),
      forumId: String(draftForum?.id || draft.forumId || ''),
      section: nextSection || defaultSection,
      tags: Array.isArray(draft.tags) ? draft.tags.join(', ') : String(draft.tags || '')
    });
    setMessage('');
    setComposerUploadMessage('');
    setIsComposerOpen(true);
  }, [forums, preferredComposerForum, selectedForumOption]);

  const timeFilteredPosts = useMemo(() => {
    const cutoff = getTimeRangeCutoff(timeRange);
    if (!cutoff) {
      return posts;
    }

    return posts.filter((post) => getPostActivityAt(post) >= cutoff);
  }, [posts, timeRange]);

  const filteredPosts = useMemo(() => {
    if (selectedSections.length === 0) {
      return timeFilteredPosts;
    }

    return timeFilteredPosts.filter((post) => selectedSections.includes(post.section || fallbackSectionValue));
  }, [fallbackSectionValue, selectedSections, timeFilteredPosts]);

  const displayedPosts = useMemo(() => {
    const now = Date.now();
    return [...filteredPosts].sort((a, b) => {
      const aInsight = forumInsightMap.get(a.forum?.id || '') || forumInsightMap.get(a.forum?.slug || '') || null;
      const bInsight = forumInsightMap.get(b.forum?.id || '') || forumInsightMap.get(b.forum?.slug || '') || null;

      if (sortMode === 'new') {
        return getPostActivityAt(b) - getPostActivityAt(a);
      }

      if (sortMode === 'top') {
        return getTopScore(b) - getTopScore(a)
          || getPostViewCount(b) - getPostViewCount(a)
          || getPostActivityAt(b) - getPostActivityAt(a);
      }

      if (sortMode === 'rising') {
        const scoreDiff = getRisingScore(b, bInsight, now, isAggregateView)
          - getRisingScore(a, aInsight, now, isAggregateView);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
      }

      if (sortMode === 'hot') {
        const scoreDiff = getHotScore(b, bInsight, now, isAggregateView)
          - getHotScore(a, aInsight, now, isAggregateView);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
      }

      if (sortMode === 'best') {
        const scoreDiff = getBestScore(b, bInsight, now, isAggregateView)
          - getBestScore(a, aInsight, now, isAggregateView);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
      }

      return getPostActivityAt(b) - getPostActivityAt(a);
    });
  }, [filteredPosts, forumInsightMap, isAggregateView, sortMode]);

  const displayedFeedCards = useMemo(() => (
    displayedPosts.map((post) => ({
      post,
      coverImage: getPostCoverImage(post.content),
      textPreview: getTextCardPreview(post.content)
    }))
  ), [displayedPosts]);
  const useSparseFeedLayout = displayedFeedCards.length > 0 && displayedFeedCards.length <= getSparseFeedThreshold(viewportWidth);

  const sectionCounts = useMemo(() => {
    const counts = {};
    for (const post of timeFilteredPosts) {
      const key = post.section || fallbackSectionValue;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [fallbackSectionValue, timeFilteredPosts]);

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
        { label: 'Followed Spaces', options: followedOptions },
        { label: 'All Spaces', options: otherOptions }
      ];
    }

    return [
      {
        label: 'Spaces',
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
      { value: '__all__', label: 'All Spaces' }
    ];

    if (!isAggregateView && selectedForum?.slug && !selectedForum.isFollowing) {
      options.push({ value: selectedForum.slug, label: selectedForum.name });
    }

    if (followedForums.length > 0) {
      options.push({
        label: 'Subscribed Spaces',
        options: followedForums.map((forum) => ({
          value: forum.slug,
          label: forum.name
        }))
      });
    }

    return options;
  }, [forumInsightMap, forums, isAggregateView, selectedForum]);

  const selectedFeedSwitcherValue = useMemo(() => {
    if (isAggregateView) {
      return '__all__';
    }
    if (selectedForum?.slug) {
      return selectedForum.slug;
    }
    return '';
  }, [isAggregateView, selectedForum]);

  useEffect(() => {
    setSelectedSections(sectionId ? [sectionId] : []);
  }, [sectionId, selectedForumSlug]);

  useEffect(() => {
    setSortMode(defaultSortMode);
  }, [defaultSortMode]);

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
        page: 1,
        pageSize: 'all'
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deferredSearchQuery, onLoadPosts, selectedForumSlug]);

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
      setSelectedSections([]);
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

  const resetFeedFilters = () => {
    setSearchQuery('');
    setSelectedSections([]);
    setTimeRange('all');
    setSortMode(defaultSortMode);
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
      setMessage(isFollowingSelectedForum ? 'Space removed from your saved list.' : 'Space saved to your list.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update saved space.');
    } finally {
      setFollowPending(false);
    }
  };

  const submitPost = async (event) => {
    event.preventDefault();
    setMessage('');
    const publishedContent = form.content;

    if (!form.forumId) {
      setMessage('Choose a space first.');
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

    await cleanupComposerAssets('unused', publishedContent);

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
    setComposerUploadMessage('');
    setComposerUploadedAssets([]);
    setSearchQuery('');
    setSelectedSections([]);
    await Promise.all([
      onLoadPosts({ q: '', forum: selectedForumSlug, page: 1, pageSize: 'all' }),
      onLoadForums()
    ]);
    setIsComposerOpen(false);
    setMessage('Post published.');
  };

  const insertCodeTemplate = () => {
    const snippet = `\n\`\`\`${composerLanguage}\n// add code here\n\`\`\`\n`;
    setForm((prev) => ({
      ...prev,
      content: `${String(prev.content || '').trimEnd()}${snippet}`
    }));
  };

  const openComposerImagePicker = useCallback(() => {
    composerFileInputRef.current?.click();
  }, []);

  const handleComposerImageSelected = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    const token = authStorage.getToken();
    if (!token) {
      setMessage('Login expired. Please sign in again before uploading.');
      return;
    }

    setMessage('');
    setComposerUploadMessage('');
    setComposerUploadLoading(true);
    try {
      const asset = await apiUploadMediaFile(file, token);
      setComposerUploadedAssets((current) => (
        current.some((entry) => entry.id === asset.id)
          ? current
          : [...current, { id: asset.id, token: buildMediaToken(asset.id) }]
      ));
      const imageMarkdown = buildImageMarkdown(file.name, asset.id);
      setForm((prev) => ({
        ...prev,
        content: `${String(prev.content || '').trimEnd()}${imageMarkdown}`
      }));
      setComposerUploadMessage('Image uploaded and inserted into the draft.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to upload image.');
    } finally {
      setComposerUploadLoading(false);
    }
  }, []);

  const cleanupComposerAssets = useCallback(async (mode = 'all', content = '') => {
    if (composerUploadedAssets.length === 0) {
      return;
    }

    const token = authStorage.getToken();
    if (!token) {
      setComposerUploadedAssets(mode === 'unused' ? composerUploadedAssets.filter((asset) => String(content || '').includes(asset.token)) : []);
      return;
    }

    const assetsToDelete = mode === 'unused'
      ? getUnusedUploadedAssets(composerUploadedAssets, content)
      : composerUploadedAssets;

    if (assetsToDelete.length === 0) {
      if (mode === 'all') {
        setComposerUploadedAssets([]);
      }
      return;
    }

    await Promise.allSettled(
      assetsToDelete.map((asset) => apiDeleteMediaAsset(asset.id, token))
    );

    if (mode === 'unused') {
      setComposerUploadedAssets((current) => current.filter((asset) => String(content || '').includes(asset.token)));
      return;
    }

    setComposerUploadedAssets([]);
  }, [composerUploadedAssets]);

  const stopComposerAiRewrite = useCallback(() => {
    composerAiAbortController?.abort();
    setComposerAiAbortController(null);
    setComposerAiLoading(false);
  }, [composerAiAbortController]);

  const closeComposer = useCallback(() => {
    void cleanupComposerAssets('all');
    stopComposerAiRewrite();
    setComposerAiOpen(false);
    setComposerAiInstruction('');
    setComposerAiMessage('');
    setComposerUploadMessage('');
    setComposerUploadedAssets([]);
    setIsComposerOpen(false);
  }, [cleanupComposerAssets, stopComposerAiRewrite]);

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

    setForm((current) => {
      const nextSection = rewrittenDraft.section || current.section;
      const currentForum = forums.find((forum) => forum.id === current.forumId) || preferredComposerForum;
      const nextForum = forumSupportsSection(currentForum, nextSection)
        ? currentForum
        : resolveComposerForumForDraft({ forumId: current.forumId, section: nextSection }, forums, selectedForumOption, preferredComposerForum);

      return {
        ...current,
        title: rewrittenDraft.title || current.title,
        content: rewrittenDraft.content || current.content,
        forumId: nextForum?.id || current.forumId,
        section: nextSection,
        tags: Array.isArray(rewrittenDraft.tags) ? rewrittenDraft.tags.join(', ') : current.tags
      };
    });
    setComposerAiMessage(result.data?.generation?.rationale || 'AI rewrite applied to the draft. Review it, then publish when you are ready.');
  }, [composerAiInstruction, form, forums, onAiRewritePostDraft, preferredComposerForum, selectedForumOption]);

  const moderatePost = async (post) => {
    const forumId = post.forum?.id;
    if (!forumId) {
      setMessage('This post is not attached to a space yet.');
      return;
    }

    const reason = window.prompt('Why are you removing this post from the space?', 'Needs review');
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
  const activeSectionOptions = useMemo(() => {
    const scopedValues = getSectionValues(activeForumForComposer?.sectionScope || []);
    const currentSection = String(form.section || '').trim();
    const mergedValues = currentSection && !scopedValues.includes(currentSection)
      ? [currentSection, ...scopedValues]
      : scopedValues;
    return getSectionSelectOptions(mergedValues.length > 0 ? mergedValues : forums);
  }, [activeForumForComposer?.sectionScope, form.section, forums]);
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
      <section className={`panel mb-4 forum-view-intro ${isAggregateView ? 'is-aggregate-view' : 'is-forum-view'}`.trim()}>
        <div className="forum-view-intro-row">
          <div className="forum-view-intro-main">
            <div className="forum-view-intro-copy-block">
              <div className="forum-view-intro-kicker-row">
                <p className="type-kicker mb-0">{isAggregateView ? 'Community Feed' : 'Space'}</p>
                <span className="forum-view-intro-status-pill">{isAggregateView ? 'Cross-space' : 'Live board'}</span>
              </div>
              <h3 className="mb-1 type-title-md">
                {isAggregateView ? 'All spaces, one smart feed' : selectedForum?.name || 'Space'}
              </h3>
              <p className="forum-view-intro-copy mb-0">
                {isAggregateView
                  ? 'Posts here are prioritized by the spaces you follow, recent updates, and overall space activity.'
                  : (selectedForum?.description || 'Browse posts and practical writeups from this space.')}
              </p>
              {isAggregateView && (
                <div className="forum-view-intro-meta-row">
                  <span className="forum-view-intro-badge">
                    <strong>{forums.length}</strong>
                    <span>Spaces in feed</span>
                  </span>
                  <span className="forum-view-intro-badge">
                    <strong>{followedForumCount}</strong>
                    <span>Following</span>
                  </span>
                  <span className="forum-view-intro-badge">
                    <strong>{displayedPosts.length}</strong>
                    <span>Visible posts</span>
                  </span>
                </div>
              )}

              {!isAggregateView && (
                <div className="forum-view-intro-meta-row">
                  <span className="forum-view-intro-badge">
                    <strong>{selectedForum?.sectionScope?.length || 0}</strong>
                    <span>Sections</span>
                  </span>
                  <span className="forum-view-intro-badge">
                    <strong>{activeSortLabel}</strong>
                    <span>Ranking</span>
                  </span>
                  <span className="forum-view-intro-badge">
                    <strong>{activeTimeRangeLabel}</strong>
                    <span>Time range</span>
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
              <span className="explore-intro-link-copy">Browse more spaces and trending communities.</span>
              <span className="explore-intro-link-footer">
                <span>Space directory</span>
                <span className="explore-intro-link-arrow" aria-hidden="true">↗</span>
              </span>
            </Link>
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
                    {followPending ? 'Updating...' : isFollowingSelectedForum ? 'Unfollow Space' : 'Follow Space'}
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
          <section className="panel mb-4 forum-filter-panel">
            <div className="forum-sections-head mb-3">
              <div>
                <h3 className="mb-1 type-title-md">Filters</h3>
                <p className="type-body mb-0">
                  {isAggregateView
                    ? 'Tune the feed with search, time window, and ranking filters across all spaces.'
                    : 'Combine section, time window, and ranking filters inside this space.'}
                </p>
              </div>
              {!isAggregateView && (
                <div className="forum-sections-head-actions">
                  <span className="muted">{sectionDisplayScope.length || 0} sections</span>
                </div>
              )}
            </div>

            <div className="forum-filter-shell mb-3">
              <div className="forum-filter-search-row">
                <input
                  className="form-control forum-input tag-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAggregateView ? 'Search posts across all spaces' : 'Search title, content, tags, author, section'}
                />
                {searchQuery && (
                  <button type="button" className="forum-secondary-btn" onClick={() => setSearchQuery('')}>
                    Clear Search
                  </button>
                )}
              </div>

              <div className="forum-filter-controls">
                {currentUser && followedForumOptions.length > 1 && (
                  <label className="forum-filter-control">
                    <span className="forum-filter-control-label">Space scope</span>
                    <div className="forum-native-select-wrap">
                      <select
                        className="forum-native-select"
                        value={selectedFeedSwitcherValue}
                        onChange={(e) => switchForumFeed(e.target.value)}
                      >
                        {renderNativeSelectOptions(followedForumOptions)}
                      </select>
                    </div>
                  </label>
                )}

                <label className="forum-filter-control">
                  <span className="forum-filter-control-label">Sort by</span>
                  <div className="forum-native-select-wrap">
                    <select
                      className="forum-native-select"
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value)}
                    >
                      {renderNativeSelectOptions(FEED_SORT_OPTIONS)}
                    </select>
                  </div>
                </label>

                <label className="forum-filter-control">
                  <span className="forum-filter-control-label">Time range</span>
                  <div className="forum-native-select-wrap">
                    <select
                      className="forum-native-select"
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                    >
                      {renderNativeSelectOptions(FEED_TIME_RANGE_OPTIONS)}
                    </select>
                  </div>
                </label>
              </div>

              {(searchQuery || selectedSections.length > 0 || timeRange !== 'all' || sortMode !== defaultSortMode) && (
                <div className="forum-filter-footer">
                  <button type="button" className="forum-secondary-btn" onClick={resetFeedFilters}>
                    Reset Filters
                  </button>
                </div>
              )}
            </div>

            {!isAggregateView && (
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
            )}

            {!isAggregateView && selectedSections.length > 0 && (
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

          <section className="panel forum-feed-panel">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <div>
                <h3 className="mb-1 type-title-md">{isAggregateView ? 'Smart Feed' : 'Space Posts'}</h3>
                <p className="muted mb-0">
                  {isAggregateView
                    ? 'Every post keeps its space label so users always know where it came from.'
                    : 'Posts inside this space, ordered by your current filters.'}
                </p>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="muted">
                  {displayedPosts.length}
                  {posts.length !== displayedPosts.length ? ` of ${posts.length}` : ''} posts
                </span>
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

            {message && <div className="settings-alert is-success mb-3">{message}</div>}
            {loadingPosts && <p className="muted mb-3">Refreshing posts...</p>}

            <div className={`forum-feed ${useSparseFeedLayout ? 'is-sparse' : ''}`.trim()}>
              {displayedFeedCards.map(({ post, coverImage, textPreview }) => (
                <article key={post.id} className="forum-post-card">
                  <Link to={`/forum/post/${post.id}`} className="forum-post-cover-link">
                    <div className={`forum-post-cover ${coverImage ? 'has-image' : 'is-title-only'}`.trim()}>
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt={post.title}
                          className="forum-post-cover-image"
                          loading="lazy"
                        />
                      ) : (
                        <div className="forum-post-cover-fallback">
                          <div className="forum-post-cover-fallback-copy">
                            <span className="forum-post-cover-fallback-title">{post.title}</span>
                          </div>
                        </div>
                      )}
                      <div className="forum-post-cover-badges">
                        {post.forum?.name && post.forum?.slug ? (
                          <span className="forum-origin-chip">
                            <span className="forum-origin-chip-label">Space</span>
                            <span>{post.forum.name}</span>
                          </span>
                        ) : (
                          <span className="forum-origin-chip is-static">
                            <span className="forum-origin-chip-label">Space</span>
                            <span>{post.forum?.name || 'General'}</span>
                          </span>
                        )}
                        {!isAggregateView && (
                          <span className="forum-tag">{getSectionLabel(post.section)}</span>
                        )}
                      </div>
                    </div>
                  </Link>

                  <div className="forum-post-card-body">
                    {coverImage && (
                      <h5 className="mb-0 forum-post-card-title">
                        <Link to={`/forum/post/${post.id}`} className="post-title-link">
                          {post.title}
                        </Link>
                      </h5>
                    )}

                    {!coverImage && (
                      <p className="mb-0 forum-post-card-summary">
                        <Link to={`/forum/post/${post.id}`} className="forum-post-summary-link">
                          {textPreview || post.title}
                        </Link>
                      </p>
                    )}

                    <div className="forum-post-card-meta">
                      <Link to={`/users/${post.authorId}`} className="forum-post-author-link">
                        {post.authorAvatarUrl ? (
                          <img
                            src={post.authorAvatarUrl}
                            alt={post.authorName}
                            className="forum-post-author-avatar-image"
                          />
                        ) : (
                          <span className="forum-post-author-avatar" aria-hidden="true">{getAuthorInitial(post.authorName)}</span>
                        )}
                        <span className="forum-post-author-name">{post.authorName}</span>
                      </Link>
                      <span className="forum-post-card-views">{getPostViewCount(post)} views</span>
                    </div>

                    {canManagePost(post) && (
                      <div className="forum-post-card-submeta">
                        <button type="button" className="forum-danger-btn forum-post-card-remove" onClick={() => moderatePost(post)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}

              {!loadingPosts && displayedPosts.length === 0 && (
                <p className="muted mb-0">
                  {isAggregateView
                    ? 'No posts match the current search and feed filters.'
                    : 'No posts match the current search, section, and time filters.'}
                </p>
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
                <label className="form-label">Space</label>
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
                        section: forumSupportsSection(nextForum, prev.section)
                          ? prev.section
                          : getScopedDefaultSection(nextForum, forums)
                      }));
                    }}
                    placeholder="Choose a space"
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
                <input
                  ref={composerFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="d-none"
                  onChange={handleComposerImageSelected}
                />
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
                    <button
                      type="button"
                      className="forum-secondary-btn"
                      disabled={composerUploadLoading}
                      onClick={openComposerImagePicker}
                    >
                      {composerUploadLoading ? 'Uploading Image...' : 'Upload Image'}
                    </button>
                  </div>
                )}
                {!showComposerCodeTools && (
                  <div className="composer-toolbar">
                    <button
                      type="button"
                      className="forum-secondary-btn"
                      disabled={composerUploadLoading}
                      onClick={openComposerImagePicker}
                    >
                      {composerUploadLoading ? 'Uploading Image...' : 'Upload Image'}
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
                    : 'This space keeps the composer simple, so the code block shortcut is hidden.'}
                </div>
                {composerUploadMessage && <div className="form-help">{composerUploadMessage}</div>}
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
