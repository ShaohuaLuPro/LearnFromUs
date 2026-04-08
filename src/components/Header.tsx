import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Offcanvas } from 'react-bootstrap';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { apiGetPosts, apiSearchUsers } from '../api';
import type { Forum, NetworkUser, Post } from '../types';
import Avatar from './Avatar';
import SidebarToggleButton from './SidebarToggleButton';
import {
  GLOBAL_SEARCH_PLACEHOLDER,
  GLOBAL_SEARCH_QUICK_LINKS,
  GLOBAL_SEARCH_SUGGESTIONS
} from './siteChromeConfig';

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  adminPermissions?: string[];
  hasAdminAccess?: boolean;
  canManageAdminAccess?: boolean;
} | null;

type HeaderProps = {
  currentUser: CurrentUser;
  forums: Forum[];
  posts: Post[];
  onLogout: () => void;
};

type DropdownItem = {
  key: string;
  label: string;
  to?: string;
  onSelect?: () => void;
};

type SearchPostSuggestion = Pick<Post, 'id' | 'title' | 'content' | 'forum' | 'section' | 'tags'>;
type SearchUserSuggestion = Pick<NetworkUser, 'id' | 'name' | 'bio' | 'avatarUrl' | 'followerCount'>;
type SearchActionItem =
  | { key: string; label: string; meta?: string; description?: string; type: 'user'; onSelect: () => void }
  | { key: string; label: string; meta?: string; type: 'forum'; onSelect: () => void }
  | { key: string; label: string; meta?: string; description?: string; type: 'post'; onSelect: () => void }
  | { key: string; label: string; meta?: string; type: 'query'; onSelect: () => void }
  | { key: string; label: string; meta?: string; type: 'link'; onSelect: () => void };

type SidebarItem = {
  key: string;
  label: string;
  to: string;
  icon: string;
};

function getSearchScore(value: string, query: string) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const normalizedValue = value.toLowerCase();
  if (normalizedValue === query) {
    return 0;
  }
  if (normalizedValue.startsWith(query)) {
    return 1;
  }
  if (normalizedValue.split(/[\s-&/]+/).some((part) => part.startsWith(query))) {
    return 2;
  }
  if (normalizedValue.includes(query)) {
    return 3;
  }
  return Number.POSITIVE_INFINITY;
}

function buildPostPreview(content: string) {
  return content
    .replace(/[#>*_`~[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110);
}

function formatCompactCount(value: number) {
  const count = Number(value || 0);
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

function mergePostMatches(...groups: SearchPostSuggestion[][]) {
  const seen = new Set<string>();
  const merged: SearchPostSuggestion[] = [];

  groups.forEach((group) => {
    group.forEach((post) => {
      if (seen.has(post.id)) {
        return;
      }
      seen.add(post.id);
      merged.push(post);
    });
  });

  return merged.slice(0, 8);
}

function mergeUserMatches(...groups: SearchUserSuggestion[][]) {
  const seen = new Set<string>();
  const merged: SearchUserSuggestion[] = [];

  groups.forEach((group) => {
    group.forEach((user) => {
      const userId = String(user?.id || '').trim();
      if (!userId || seen.has(userId)) {
        return;
      }
      seen.add(userId);
      merged.push(user);
    });
  });

  return merged.slice(0, 6);
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M13.7 12.3 17 15.6l-1.4 1.4-3.3-3.3a6 6 0 1 1 1.4-1.4ZM8.5 13A4.5 4.5 0 1 0 8.5 4a4.5 4.5 0 0 0 0 9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 5h14v2H3V5Zm0 4h14v2H3V9Zm0 4h14v2H3v-2Z" fill="currentColor" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="m10 2 1.8 4.2L16 8l-4.2 1.8L10 14l-1.8-4.2L4 8l4.2-1.8L10 2Z" fill="currentColor" />
    </svg>
  );
}

export default function Header({ currentUser, forums, posts, onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 992px)').matches
  ));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      return window.localStorage.getItem('tsumit.sidebarCollapsed') === '1';
    } catch (_) {
      return false;
    }
  });
  const [adminMode, setAdminMode] = useState(false);
  const [forumQuery, setForumQuery] = useState('');
  const [remotePostMatches, setRemotePostMatches] = useState<SearchPostSuggestion[]>([]);
  const [remoteUserMatches, setRemoteUserMatches] = useState<SearchUserSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [highlightedResultIndex, setHighlightedResultIndex] = useState(-1);
  const searchRequestIdRef = useRef(0);
  const deferredForumQuery = useDeferredValue(forumQuery);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);

  const isAdminUser = Boolean(
    currentUser
    && (
      currentUser.isAdmin
      || currentUser.hasAdminAccess
      || currentUser.canManageAdminAccess
      || (currentUser.adminPermissions?.length || 0) > 0
    )
  );
  const userDisplayName = String(currentUser?.name || currentUser?.email || 'User').trim() || 'User';

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 992px)');
    const syncViewportMode = (event?: MediaQueryListEvent) => {
      const desktop = event?.matches ?? mediaQuery.matches;
      setIsDesktop(desktop);
      setIsDrawerOpen(false);
      setUserMenuOpen(false);
      setHighlightedResultIndex(-1);
      if (desktop) {
        setIsMobileSearchOpen(false);
      } else {
        setIsSearchOpen(false);
      }
    };

    syncViewportMode();
    mediaQuery.addEventListener('change', syncViewportMode);
    return () => mediaQuery.removeEventListener('change', syncViewportMode);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
    setIsDrawerOpen(false);
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = window.localStorage.getItem('tsumit.recentSearches');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((value) => typeof value === 'string').slice(0, 4));
        }
      }
    } catch (_) {
      // Ignore malformed local storage.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem('tsumit.sidebarCollapsed', isSidebarCollapsed ? '1' : '0');
    } catch (_) {
      // Ignore storage errors.
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const collapsed = Boolean(isDesktop && isSidebarCollapsed);
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    return () => document.body.classList.remove('sidebar-collapsed');
  }, [isDesktop, isSidebarCollapsed]);

  useEffect(() => {
    if (!currentUser || !isAdminUser) {
      setAdminMode(false);
      return;
    }

    try {
      const stored = window.sessionStorage.getItem(`tsumit.adminMode.${currentUser.id}`);
      setAdminMode(stored === '1');
    } catch (_) {
      setAdminMode(false);
    }
  }, [currentUser, isAdminUser]);

  useEffect(() => {
    if (!currentUser || !isAdminUser) {
      return;
    }

    try {
      window.sessionStorage.setItem(`tsumit.adminMode.${currentUser.id}`, adminMode ? '1' : '0');
      window.dispatchEvent(new CustomEvent('tsumit:admin-mode-changed', {
        detail: {
          userId: currentUser.id,
          enabled: adminMode
        }
      }));
    } catch (_) {
      // Ignore storage errors so navigation still works.
    }
  }, [adminMode, currentUser, isAdminUser]);

  useEffect(() => {
    const query = deferredForumQuery.trim();
    if (query.length < 2 || (!isSearchOpen && !isMobileSearchOpen)) {
      setRemotePostMatches([]);
      setRemoteUserMatches([]);
      setSearchLoading(false);
      return undefined;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [postResponse, userResponse] = await Promise.all([
          apiGetPosts({
            q: query,
            page: 1,
            pageSize: 5
          }),
          apiSearchUsers(query, 6)
        ]);

        if (searchRequestIdRef.current === requestId) {
          setRemotePostMatches(postResponse.posts || []);
          setRemoteUserMatches(userResponse.users || []);
        }
      } catch (_) {
        if (searchRequestIdRef.current === requestId) {
          setRemotePostMatches([]);
          setRemoteUserMatches([]);
        }
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setSearchLoading(false);
        }
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [deferredForumQuery, isMobileSearchOpen, isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (
        desktopSearchRef.current
        && target instanceof Node
        && !desktopSearchRef.current.contains(target)
      ) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (userMenuRef.current && target instanceof Node && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (isSearchOpen && isDesktop) {
      desktopSearchInputRef.current?.focus();
    }
  }, [isDesktop, isSearchOpen]);

  useEffect(() => {
    if (isMobileSearchOpen && !isDesktop) {
      window.setTimeout(() => mobileSearchInputRef.current?.focus(), 30);
    }
  }, [isDesktop, isMobileSearchOpen]);

  const commitRecentSearch = useCallback((value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }

    setRecentSearches((current) => {
      const next = [normalized, ...current.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())].slice(0, 4);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('tsumit.recentSearches', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const matchingForums = useMemo(() => {
    const query = forumQuery.trim().toLowerCase();
    if (!query) {
      return forums.slice(0, 5);
    }

    return [...forums]
      .map((forum) => ({
        forum,
        score: Math.min(
          getSearchScore(forum.name, query),
          getSearchScore(forum.slug, query),
          getSearchScore(forum.description || '', query)
        )
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => left.score - right.score || left.forum.name.localeCompare(right.forum.name))
      .map((entry) => entry.forum)
      .slice(0, 5);
  }, [forumQuery, forums]);

  const localPostMatches = useMemo(() => {
    const query = forumQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return [...posts]
      .map((post) => ({
        post,
        score: Math.min(
          getSearchScore(post.title, query),
          getSearchScore(post.content, query),
          getSearchScore(post.section, query),
          getSearchScore(post.forum?.name || '', query),
          getSearchScore((post.tags || []).join(' '), query)
        )
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => left.score - right.score || left.post.title.localeCompare(right.post.title))
      .map((entry) => entry.post)
      .slice(0, 5);
  }, [forumQuery, posts]);

  const postMatches = useMemo(
    () => mergePostMatches(localPostMatches, remotePostMatches),
    [localPostMatches, remotePostMatches]
  );

  const localUserMatches = useMemo(() => {
    const query = forumQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const authorMap = new Map<string, SearchUserSuggestion & { postCount: number; score: number }>();
    posts.forEach((post) => {
      const authorId = String(post.authorId || '').trim();
      if (!authorId) {
        return;
      }
      const authorName = String(post.authorName || '').trim();
      const score = getSearchScore(authorName, query);
      if (!Number.isFinite(score)) {
        return;
      }

      const current = authorMap.get(authorId) || {
        id: authorId,
        name: authorName || 'User',
        bio: '',
        avatarUrl: post.authorAvatarUrl || '',
        followerCount: 0,
        postCount: 0,
        score
      };

      current.name = authorName || current.name;
      current.avatarUrl = String(post.authorAvatarUrl || current.avatarUrl || '');
      current.postCount += 1;
      current.score = Math.min(current.score, score);
      authorMap.set(authorId, current);
    });

    return Array.from(authorMap.values())
      .sort((left, right) => left.score - right.score || right.postCount - left.postCount || left.name.localeCompare(right.name))
      .map(({ postCount: _count, score: _score, ...user }) => user)
      .slice(0, 6);
  }, [forumQuery, posts]);

  const userMatches = useMemo(
    () => mergeUserMatches(localUserMatches, remoteUserMatches),
    [localUserMatches, remoteUserMatches]
  );

  const openAssistant = () => {
    window.dispatchEvent(new Event('assistant:open'));
  };

  const openComposer = () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    navigate('/forum?compose=1');
  };

  const closeOverlays = () => {
    setIsDrawerOpen(false);
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    setUserMenuOpen(false);
  };

  const goToForum = useCallback((slug: string) => {
    const forum = forums.find((entry) => entry.slug === slug);
    if (forum?.name) {
      commitRecentSearch(forum.name);
    }
    closeOverlays();
    navigate(`/forum/${slug}`);
  }, [commitRecentSearch, forums, navigate]);

  const goToPost = useCallback((postId: string) => {
    const post = postMatches.find((entry) => entry.id === postId) || posts.find((entry) => entry.id === postId);
    if (post?.title) {
      commitRecentSearch(post.title);
    }
    closeOverlays();
    navigate(`/forum/post/${postId}`);
  }, [commitRecentSearch, navigate, postMatches, posts]);

  const goToUser = useCallback((userId: string, userName?: string) => {
    const cleanUserId = String(userId || '').trim();
    if (!cleanUserId) {
      return;
    }
    if (userName) {
      commitRecentSearch(userName);
    }
    closeOverlays();
    navigate(`/users/${cleanUserId}`);
  }, [commitRecentSearch, navigate]);

  const applyQuerySearch = useCallback((query: string) => {
    setForumQuery(query);
    commitRecentSearch(query);
    if (isDesktop) {
      desktopSearchInputRef.current?.focus();
    } else {
      mobileSearchInputRef.current?.focus();
    }
  }, [commitRecentSearch, isDesktop]);

  const showHintState = forumQuery.trim().length === 0;
  const searchPanelSections = useMemo(() => {
    if (!showHintState) {
      return [
        {
          key: 'users',
          title: 'Users',
          items: userMatches.map<SearchActionItem>((user) => ({
            key: `user-${user.id}`,
            label: user.name || 'User',
            meta: user.followerCount ? `${formatCompactCount(user.followerCount)} followers` : 'Creator',
            description: user.bio || 'Open profile',
            type: 'user',
            onSelect: () => goToUser(user.id, user.name)
          }))
        },
        {
          key: 'spaces',
          title: 'Spaces',
          items: matchingForums.map<SearchActionItem>((forum) => ({
            key: `forum-${forum.id}`,
            label: forum.name,
            meta: forum.description || 'Topic space',
            type: 'forum',
            onSelect: () => goToForum(forum.slug)
          }))
        },
        {
          key: 'posts',
          title: 'Posts',
          items: postMatches.map<SearchActionItem>((post) => ({
            key: `post-${post.id}`,
            label: post.title,
            meta: [post.forum?.name, post.section].filter(Boolean).join(' · '),
            description: buildPostPreview(post.content),
            type: 'post',
            onSelect: () => goToPost(post.id)
          }))
        }
      ].filter((section) => section.items.length > 0);
    }

    return [
      {
        key: 'recent',
        title: 'Recent',
        items: recentSearches.map<SearchActionItem>((query) => ({
          key: `recent-${query}`,
          label: query,
          meta: 'Recent search',
          type: 'query',
          onSelect: () => applyQuerySearch(query)
        }))
      },
      {
        key: 'topics',
        title: 'Suggested',
        items: GLOBAL_SEARCH_SUGGESTIONS.map<SearchActionItem>((item) => ({
          key: `suggested-${item.key}`,
          label: item.label,
          meta: 'Topic',
          type: 'query',
          onSelect: () => applyQuerySearch(item.label)
        }))
      },
      {
        key: 'quick-links',
        title: 'Quick links',
        items: GLOBAL_SEARCH_QUICK_LINKS.map<SearchActionItem>((item) => ({
          key: `quick-${item.key}`,
          label: item.label,
          meta: 'Shortcut',
          type: 'link',
          onSelect: () => {
            commitRecentSearch(item.label);
            closeOverlays();
            navigate(item.to);
          }
        }))
      }
    ].filter((section) => section.items.length > 0);
  }, [
    applyQuerySearch,
    commitRecentSearch,
    goToForum,
    goToPost,
    goToUser,
    matchingForums,
    navigate,
    postMatches,
    recentSearches,
    userMatches,
    showHintState
  ]);

  const flatSearchItems = useMemo(
    () => searchPanelSections.flatMap((section) => section.items),
    [searchPanelSections]
  );

  const adminDropdownItems = useMemo<DropdownItem[]>(() => {
    if (!currentUser || !isAdminUser) {
      return [];
    }

    return [
      (currentUser.isAdmin || currentUser.adminPermissions?.includes('moderation'))
        ? { key: 'moderation', label: 'Moderation', to: '/moderation' }
        : null,
      (currentUser.isAdmin || currentUser.adminPermissions?.includes('forum_requests'))
        ? { key: 'space-requests', label: 'Space Requests', to: '/forums/request/review' }
        : null,
      (currentUser.isAdmin || currentUser.adminPermissions?.includes('analytics'))
        ? { key: 'analytics', label: 'Analytics', to: '/analytics' }
        : null,
      (currentUser.isAdmin || currentUser.adminPermissions?.includes('password_reset'))
        ? { key: 'password-reset', label: 'Password Reset', to: '/admin/password-reset' }
        : null,
      currentUser.canManageAdminAccess
        ? { key: 'admin-management', label: 'Admin Management', to: '/admin/access' }
        : null
    ].filter(Boolean) as DropdownItem[];
  }, [currentUser, isAdminUser]);

  const userDropdownItems = useMemo<DropdownItem[]>(
    () => currentUser ? [
      { key: 'profile', label: 'My Profile', to: `/users/${currentUser.id}` },
      { key: 'posts', label: 'My Posts', to: '/my-posts' },
      { key: 'spaces', label: 'My Spaces', to: '/my-spaces' },
      { key: 'following', label: 'Following', to: '/following' },
      { key: 'settings', label: 'Settings', to: '/settings' }
    ] : [],
    [currentUser]
  );

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const base: SidebarItem[] = [
      { key: 'discover', label: 'Discover', to: '/explore', icon: 'D' },
      { key: 'feed', label: 'Feed', to: '/forum', icon: 'F' },
      { key: 'inbox', label: 'Inbox', to: currentUser ? '/my-spaces/invitations' : '/login', icon: 'I' },
      { key: 'profile', label: 'Profile', to: currentUser ? `/users/${currentUser.id}` : '/login', icon: 'P' }
    ];

    if (isAdminUser && adminMode && adminDropdownItems.length > 0) {
      base.push({
        key: 'admin',
        label: 'Admin',
        to: adminDropdownItems[0].to || '/forum',
        icon: 'A'
      });
    }

    return base;
  }, [adminDropdownItems, adminMode, currentUser, isAdminUser]);

  const forumLastActivityMap = useMemo(() => {
    const nextMap = new Map<string, number>();
    posts.forEach((post) => {
      const forumId = post.forum?.id;
      const forumSlug = post.forum?.slug;
      const timestamp = Number(post.updatedAt || post.createdAt || 0);
      if (!timestamp) {
        return;
      }

      if (forumId) {
        nextMap.set(forumId, Math.max(nextMap.get(forumId) || 0, timestamp));
      }

      if (forumSlug) {
        nextMap.set(forumSlug, Math.max(nextMap.get(forumSlug) || 0, timestamp));
      }
    });
    return nextMap;
  }, [posts]);

  const followedSpaces = useMemo(
    () => forums.filter((forum) => Boolean(forum.isFollowing)),
    [forums]
  );

  const recentFollowedSpaces = useMemo(() => {
    return [...followedSpaces]
      .sort((a, b) => {
        const aActivity = Math.max(forumLastActivityMap.get(a.id) || 0, forumLastActivityMap.get(a.slug) || 0);
        const bActivity = Math.max(forumLastActivityMap.get(b.id) || 0, forumLastActivityMap.get(b.slug) || 0);
        if (bActivity !== aActivity) {
          return bActivity - aActivity;
        }

        const aVolume = Number(a.livePostCount || a.postCount || 0);
        const bVolume = Number(b.livePostCount || b.postCount || 0);
        if (bVolume !== aVolume) {
          return bVolume - aVolume;
        }

        return a.name.localeCompare(b.name);
      })
      .slice(0, 5);
  }, [followedSpaces, forumLastActivityMap]);

  const handleSearchInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!flatSearchItems.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedResultIndex((current) => (current + 1) % flatSearchItems.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedResultIndex((current) => (current <= 0 ? flatSearchItems.length - 1 : current - 1));
    } else if (event.key === 'Enter' && highlightedResultIndex >= 0) {
      event.preventDefault();
      flatSearchItems[highlightedResultIndex]?.onSelect();
    } else if (event.key === 'Escape') {
      setIsSearchOpen(false);
      setIsMobileSearchOpen(false);
    }
  };

  const submitForumSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (forumQuery.trim()) {
      commitRecentSearch(forumQuery);
    }
    const firstResult =
      userMatches[0]
        ? { type: 'user' as const, value: userMatches[0] }
        : matchingForums[0]
          ? { type: 'forum' as const, value: matchingForums[0] }
        : postMatches[0]
          ? { type: 'post' as const, value: postMatches[0] }
          : null;

    if (!firstResult) {
      return;
    }

    if (firstResult.type === 'user') {
      goToUser(firstResult.value.id, firstResult.value.name);
      return;
    }

    if (firstResult.type === 'forum') {
      goToForum(firstResult.value.slug);
      return;
    }

    goToPost(firstResult.value.id);
  };

  const renderSearchResults = () => (
    <div className="platform-search-panel" role="dialog" aria-label="Global search panel">
      {searchLoading ? (
        <div className="platform-search-empty">Searching...</div>
      ) : searchPanelSections.length > 0 ? (
        <div className="platform-search-sections">
          {searchPanelSections.map((section) => (
            <section key={section.key} className="platform-search-section">
              <div className="platform-search-section-label">{section.title}</div>
              <div className="platform-search-section-body">
                {section.items.map((item) => {
                  const itemIndex = flatSearchItems.findIndex((entry) => entry.key === item.key);
                  return (
                    <button
                      key={item.key}
                      id={item.key}
                      type="button"
                      className={`platform-search-result ${highlightedResultIndex === itemIndex ? 'is-highlighted' : ''}`.trim()}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedResultIndex(itemIndex)}
                      onFocus={() => setHighlightedResultIndex(itemIndex)}
                      onClick={item.onSelect}
                    >
                      <span className="platform-search-result-main">
                        <strong>{item.label}</strong>
                        {item.meta ? <span>{item.meta}</span> : null}
                      </span>
                      {'description' in item && item.description ? <span>{item.description}</span> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="platform-search-empty">No similar users, spaces, or posts</div>
      )}
    </div>
  );

  const renderSidebarNav = (isDrawer = false) => (
    <nav
      className={`platform-sidebar-nav ${isDrawer ? 'is-drawer' : ''} ${isSidebarCollapsed && !isDrawer ? 'is-collapsed' : ''}`.trim()}
      aria-label="Primary navigation"
    >
      {sidebarItems.map((item) => (
        <NavLink
          key={item.key}
          to={item.to}
          className={({ isActive }) => `platform-sidebar-link ${isActive ? 'is-active' : ''}`.trim()}
          onClick={() => setIsDrawerOpen(false)}
          title={isSidebarCollapsed && !isDrawer ? item.label : undefined}
        >
          <span className="platform-sidebar-link-icon" aria-hidden="true">{item.icon}</span>
          <span className="platform-sidebar-link-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  const renderSidebarSpaces = (isDrawer = false) => {
    if (isSidebarCollapsed && !isDrawer) {
      return null;
    }

    return (
      <section className={`platform-sidebar-spaces ${isDrawer ? 'is-drawer' : ''}`.trim()} aria-label="Followed spaces">
        <div className="platform-sidebar-spaces-head">
          <span className="platform-sidebar-spaces-title">Spaces</span>
        </div>

        {recentFollowedSpaces.length > 0 ? (
          <div className="platform-sidebar-space-list">
            {recentFollowedSpaces.map((forum) => (
              <NavLink
                key={`space-${forum.id}`}
                to={`/forum/${forum.slug}`}
                className={({ isActive }) => `platform-sidebar-space-link ${isActive ? 'is-active' : ''}`.trim()}
                onClick={() => setIsDrawerOpen(false)}
                title={forum.name}
              >
                <span className="platform-sidebar-space-avatar" aria-hidden="true">
                  {String(forum.name || '').trim().charAt(0).toUpperCase() || 'S'}
                </span>
                <span className="platform-sidebar-space-name">{forum.name}</span>
              </NavLink>
            ))}
          </div>
        ) : (
          <p className="platform-sidebar-space-empty">
            {currentUser ? 'No followed spaces yet' : 'Follow spaces to see them here'}
          </p>
        )}

        {followedSpaces.length > 5 ? (
          <NavLink to="/my-spaces" className="platform-sidebar-space-more-link" onClick={() => setIsDrawerOpen(false)}>
            ... See all
          </NavLink>
        ) : null}
      </section>
    );
  };

  return (
    <>
      <aside className={`platform-sidebar ${isSidebarCollapsed ? 'is-collapsed' : ''}`.trim()} aria-label="Primary navigation sidebar">
        <div className="platform-sidebar-head">
          <div className="platform-sidebar-caption">Navigation</div>
          <SidebarToggleButton
            collapsed={isSidebarCollapsed}
            isMobile={false}
            onToggle={() => setIsSidebarCollapsed((current) => !current)}
          />
        </div>
        {renderSidebarNav(false)}
        {renderSidebarSpaces(false)}
      </aside>

      <header className="platform-topbar">
        <div className="platform-topbar-left">
          <div className="platform-topbar-leading">
            <NavLink to="/" className="platform-topbar-brand" onClick={closeOverlays} aria-label="tsumit home">
              tsumit
            </NavLink>
          </div>
        </div>

        <div className="platform-topbar-center">
          <div className="platform-topbar-search" ref={desktopSearchRef}>
            <form className="platform-search-form" onSubmit={submitForumSearch}>
              <SearchIcon />
              <input
                ref={desktopSearchInputRef}
                className="platform-search-input"
                value={forumQuery}
                onChange={(event) => setForumQuery(event.target.value)}
                onFocus={() => {
                  setIsSearchOpen(true);
                  setHighlightedResultIndex(-1);
                }}
                onKeyDown={handleSearchInputKeyDown}
                placeholder={GLOBAL_SEARCH_PLACEHOLDER}
                aria-label="Search spaces or posts"
                aria-activedescendant={highlightedResultIndex >= 0 ? flatSearchItems[highlightedResultIndex]?.key : undefined}
              />
            </form>
            {isSearchOpen && isDesktop ? renderSearchResults() : null}
          </div>
        </div>

        <div className="platform-topbar-actions">
          <button
            type="button"
            className="platform-topbar-icon-btn platform-topbar-menu-btn"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>

          <button
            type="button"
            className="platform-topbar-icon-btn platform-topbar-mobile-search-btn"
            onClick={() => setIsMobileSearchOpen(true)}
            aria-label="Search"
          >
            <SearchIcon />
          </button>

          <button
            type="button"
            className="platform-topbar-action"
            onClick={openComposer}
          >
            Create post
          </button>

          <button
            type="button"
            className="platform-topbar-action is-ai"
            onClick={openAssistant}
          >
            <SparkIcon />
            <span>Ask AI</span>
          </button>

          {currentUser ? (
            <div className="platform-user-menu" ref={userMenuRef}>
              <button
                type="button"
                className={`platform-user-trigger ${userMenuOpen ? 'is-open' : ''}`.trim()}
                onClick={() => setUserMenuOpen((current) => !current)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={`${userMenuOpen ? 'Close' : 'Open'} user menu for ${userDisplayName}`}
              >
                <Avatar
                  imageUrl={currentUser.avatarUrl}
                  name={userDisplayName}
                  size={32}
                  className="platform-user-trigger-avatar"
                />
                <span className="platform-user-trigger-indicator" aria-hidden="true">
                  ▾
                </span>
              </button>
              <div className={`platform-user-panel ${userMenuOpen ? 'is-open' : ''}`.trim()} role="menu">
                {userDropdownItems.map((item) => (
                  <NavLink
                    key={item.key}
                    to={item.to || '/forum'}
                    className="platform-user-item"
                    role="menuitem"
                    onClick={closeOverlays}
                  >
                    {item.label}
                  </NavLink>
                ))}

                {isAdminUser ? (
                  <>
                    <div className="platform-user-divider" role="separator" />
                    <button
                      type="button"
                      className="platform-user-item is-button"
                      role="menuitemcheckbox"
                      aria-checked={adminMode}
                      onClick={() => setAdminMode((current) => !current)}
                    >
                      <span>Admin mode</span>
                      <span className={`platform-user-toggle-state ${adminMode ? 'is-on' : 'is-off'}`.trim()}>
                        {adminMode ? 'On' : 'Off'}
                      </span>
                    </button>
                  </>
                ) : null}

                {isAdminUser && adminMode && adminDropdownItems.length > 0 ? (
                  <>
                    <div className="platform-user-divider" role="separator" />
                    <div className="platform-user-section-label">Admin</div>
                    {adminDropdownItems.map((item) => (
                      <NavLink
                        key={item.key}
                        to={item.to || '/forum'}
                        className="platform-user-item"
                        role="menuitem"
                        onClick={closeOverlays}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </>
                ) : null}

                <div className="platform-user-divider" role="separator" />
                <button
                  type="button"
                  className="platform-user-item is-button"
                  role="menuitem"
                  onClick={() => {
                    closeOverlays();
                    onLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <NavLink to="/login" className="platform-topbar-action is-join" onClick={closeOverlays}>
              Join
            </NavLink>
          )}
        </div>
      </header>

      <Offcanvas
        show={isDrawerOpen}
        onHide={() => setIsDrawerOpen(false)}
        placement="start"
        className="platform-mobile-drawer"
        backdropClassName="platform-mobile-drawer-backdrop"
      >
        <Offcanvas.Header closeButton className="platform-mobile-drawer-header">
          <Offcanvas.Title className="platform-mobile-drawer-title">Navigation</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="platform-mobile-drawer-body">
          {renderSidebarNav(true)}
          {renderSidebarSpaces(true)}
        </Offcanvas.Body>
      </Offcanvas>

      <Offcanvas
        show={isMobileSearchOpen}
        onHide={() => setIsMobileSearchOpen(false)}
        placement="top"
        className="platform-mobile-search"
        backdropClassName="platform-mobile-search-backdrop"
      >
        <Offcanvas.Header closeButton className="platform-mobile-search-header">
          <Offcanvas.Title className="platform-mobile-search-title">Search</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="platform-mobile-search-body">
          <div className="platform-mobile-search-shell" ref={mobileSearchRef}>
            <form className="platform-search-form" onSubmit={submitForumSearch}>
              <SearchIcon />
              <input
                ref={mobileSearchInputRef}
                className="platform-search-input"
                value={forumQuery}
                onChange={(event) => setForumQuery(event.target.value)}
                onKeyDown={handleSearchInputKeyDown}
                placeholder={GLOBAL_SEARCH_PLACEHOLDER}
                aria-label="Search spaces or posts"
                aria-activedescendant={highlightedResultIndex >= 0 ? flatSearchItems[highlightedResultIndex]?.key : undefined}
              />
            </form>
            {renderSearchResults()}
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
