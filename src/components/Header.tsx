import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Container, Nav, Navbar, Offcanvas } from 'react-bootstrap';
import { NavLink, useNavigate } from 'react-router-dom';
import { apiGetPosts } from '../api';
import type { Forum, Post } from '../types';
import {
  GLOBAL_SEARCH_PLACEHOLDER,
  GLOBAL_SEARCH_QUICK_LINKS,
  GLOBAL_SEARCH_SUGGESTIONS,
  SITE_LOGO_SRC,
  globalNavItems
} from './siteChromeConfig';

type CurrentUser = {
  id: string;
  name: string;
  email: string;
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

type SearchPostSuggestion = Pick<Post, 'id' | 'title' | 'content' | 'forum' | 'section' | 'tags'>;
type DropdownItem = {
  key: string;
  label: string;
  to?: string;
  onSelect?: () => void;
  dividerBefore?: boolean;
};
type SearchActionItem =
  | { key: string; label: string; meta?: string; type: 'forum'; onSelect: () => void }
  | { key: string; label: string; meta?: string; description?: string; type: 'post'; onSelect: () => void }
  | { key: string; label: string; meta?: string; type: 'query'; onSelect: () => void }
  | { key: string; label: string; meta?: string; type: 'link'; onSelect: () => void };

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

export default function Header({ currentUser, forums, posts, onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const [navExpanded, setNavExpanded] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 992px)').matches
  ));
  const [adminOpen, setAdminOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [forumQuery, setForumQuery] = useState('');
  const [remotePostMatches, setRemotePostMatches] = useState<SearchPostSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [highlightedResultIndex, setHighlightedResultIndex] = useState(-1);
  const searchRequestIdRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchLayerRef = useRef<HTMLDivElement | null>(null);
  const deferredForumQuery = useDeferredValue(forumQuery);

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
    } catch (error) {
      // Ignore malformed local storage so search still works normally.
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 992px)');
    const syncViewportMode = (event?: MediaQueryListEvent) => {
      const desktop = event?.matches ?? mediaQuery.matches;
      setIsDesktop(desktop);
      setAdminOpen(false);
      setAccountOpen(false);
      setNavExpanded(false);
    };

    syncViewportMode();
    mediaQuery.addEventListener('change', syncViewportMode);
    return () => mediaQuery.removeEventListener('change', syncViewportMode);
  }, []);

  useEffect(() => {
    const syncScrollState = () => {
      setIsScrolled((window.scrollY || 0) > 18);
    };

    syncScrollState();
    window.addEventListener('scroll', syncScrollState, { passive: true });
    return () => window.removeEventListener('scroll', syncScrollState);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) {
      return undefined;
    }

    searchInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    document.body.classList.toggle('search-mode-active', isSearchOpen);

    return () => {
      document.body.classList.remove('search-mode-active');
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (searchLayerRef.current && target instanceof Node && !searchLayerRef.current.contains(target)) {
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
    if (!isSearchOpen) {
      setForumQuery('');
      setRemotePostMatches([]);
      setSearchLoading(false);
      setHighlightedResultIndex(-1);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      return undefined;
    }

    const query = deferredForumQuery.trim();
    if (query.length < 2) {
      setRemotePostMatches([]);
      setSearchLoading(false);
      return undefined;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await apiGetPosts({
          q: query,
          page: 1,
          pageSize: 5
        });

        if (searchRequestIdRef.current === requestId) {
          setRemotePostMatches(response.posts || []);
        }
      } catch (error) {
        if (searchRequestIdRef.current === requestId) {
          setRemotePostMatches([]);
        }
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setSearchLoading(false);
        }
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [deferredForumQuery, isSearchOpen]);

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

  const adminDropdownItems = useMemo<DropdownItem[]>(() => {
    if (!currentUser || !(currentUser.isAdmin || currentUser.hasAdminAccess)) {
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
  }, [currentUser]);

  const userDropdownItems = useMemo<DropdownItem[]>(
    () => currentUser ? [
      { key: 'profile', label: 'My Profile', to: `/users/${currentUser.id}` },
      { key: 'posts', label: 'My Posts', to: '/my-posts' },
      { key: 'spaces', label: 'My Spaces', to: '/my-forums' },
      { key: 'following', label: 'Following', to: '/following' },
      { key: 'settings', label: 'Settings', to: '/settings' },
      {
        key: 'logout',
        label: 'Logout',
        dividerBefore: true,
        onSelect: () => onLogout()
      }
    ] : [],
    [currentUser, onLogout]
  );

  const showHintState = forumQuery.trim().length === 0;
  const isAdminDropdownVisible = adminDropdownItems.length > 0;

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

  const closeNavOverlays = useCallback(() => {
    setAdminOpen(false);
    setAccountOpen(false);
    setNavExpanded(false);
  }, []);

  const openSearch = () => {
    closeNavOverlays();
    setIsSearchOpen(true);
  };

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handlePrimaryNavClick = () => {
    closeNavOverlays();
    closeSearch();
  };

  const handleDropdownKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, onClose: () => void) => {
    if (event.key === 'Escape') {
      onClose();
      event.currentTarget.blur();
    }
  };

  const goToForum = useCallback((slug: string) => {
    const forum = forums.find((entry) => entry.slug === slug);
    if (forum?.name) {
      commitRecentSearch(forum.name);
    }
    closeNavOverlays();
    closeSearch();
    navigate(`/forum/${slug}`);
  }, [closeNavOverlays, closeSearch, commitRecentSearch, forums, navigate]);

  const goToPost = useCallback((postId: string) => {
    const post = postMatches.find((entry) => entry.id === postId) || posts.find((entry) => entry.id === postId);
    if (post?.title) {
      commitRecentSearch(post.title);
    }
    closeNavOverlays();
    closeSearch();
    navigate(`/forum/post/${postId}`);
  }, [closeNavOverlays, closeSearch, commitRecentSearch, navigate, postMatches, posts]);

  const applyQuerySearch = useCallback((query: string) => {
    setForumQuery(query);
    commitRecentSearch(query);
    searchInputRef.current?.focus();
  }, [commitRecentSearch]);

  const submitForumSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (forumQuery.trim()) {
      commitRecentSearch(forumQuery);
    }
    const firstResult =
      matchingForums[0]
        ? { type: 'forum' as const, value: matchingForums[0] }
        : postMatches[0]
          ? { type: 'post' as const, value: postMatches[0] }
          : null;

    if (!firstResult) {
      return;
    }

    if (firstResult.type === 'forum') {
      goToForum(firstResult.value.slug);
      return;
    }

    goToPost(firstResult.value.id);
  };

  const searchPanelSections = useMemo(() => {
    if (!showHintState) {
      return [
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
        title: 'Recent searches',
        items: recentSearches.map<SearchActionItem>((query) => ({
          key: `recent-${query}`,
          label: query,
          meta: 'Recent',
          type: 'query',
          onSelect: () => applyQuerySearch(query)
        }))
      },
      {
        key: 'topics',
        title: 'Suggested topics',
        items: GLOBAL_SEARCH_SUGGESTIONS.map<SearchActionItem>((item) => ({
          key: `suggested-${item.key}`,
          label: item.label,
          meta: 'Suggested',
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
            closeNavOverlays();
            closeSearch();
            navigate(item.to);
          }
        }))
      }
    ].filter((section) => section.items.length > 0);
  }, [
    applyQuerySearch,
    closeSearch,
    closeNavOverlays,
    commitRecentSearch,
    goToForum,
    goToPost,
    matchingForums,
    navigate,
    postMatches,
    recentSearches,
    showHintState
  ]);

  const flatSearchItems = useMemo(
    () => searchPanelSections.flatMap((section) => section.items),
    [searchPanelSections]
  );

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
    }
  };

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    if (highlightedResultIndex >= flatSearchItems.length) {
      setHighlightedResultIndex(flatSearchItems.length ? 0 : -1);
    }
  }, [flatSearchItems, highlightedResultIndex, isSearchOpen]);

  const renderSearchResults = () => (
    <div className="forum-search-results site-navbar-search-results" role="dialog" aria-label="Global search panel">
      <div className="site-navbar-search-panel-head">
        <p className="site-navbar-search-kicker">Search</p>
        <p className="site-navbar-search-support">
          {showHintState
            ? 'Start with a recent search, a suggested topic, or a quick path into the site.'
            : 'Results stay quiet and structured so the right next step is easy to spot.'}
        </p>
      </div>

      {searchLoading ? (
        <div className="forum-search-empty">Searching posts...</div>
      ) : searchPanelSections.length > 0 ? (
        <div className="site-navbar-search-sections">
          {/* The panel stays data-driven by section so we can add curated search modules
              later without rewriting the search surface layout. */}
          {searchPanelSections.map((section) => (
            <section key={section.key} className="forum-search-section site-navbar-search-section">
              <div className="forum-search-section-label">{section.title}</div>
              <div className="site-navbar-search-section-body">
                {section.items.map((item) => {
                  const itemIndex = flatSearchItems.findIndex((entry) => entry.key === item.key);
                  return (
                    <button
                      key={item.key}
                      id={item.key}
                      type="button"
                      className={`forum-search-result site-navbar-search-result ${highlightedResultIndex === itemIndex ? 'is-highlighted' : ''}`.trim()}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedResultIndex(itemIndex)}
                      onFocus={() => setHighlightedResultIndex(itemIndex)}
                      onClick={item.onSelect}
                    >
                      <span className="site-navbar-search-result-main">
                        <strong>{item.label}</strong>
                        {item.meta ? <span className="forum-search-result-meta">{item.meta}</span> : null}
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
        <div className="forum-search-empty">No similar spaces or posts</div>
      )}
    </div>
  );

  const renderDropdownMenu = ({
    keyPrefix,
    label,
    isOpen,
    setOpen,
    items,
    drawerMode = false
  }: {
    keyPrefix: string;
    label: string;
    isOpen: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    items: DropdownItem[];
    drawerMode?: boolean;
  }) => {
    if (!items.length) {
      return null;
    }

    const panelId = `${keyPrefix}-menu-panel`;

    return (
      <div
        className={`site-nav-dropdown ${drawerMode ? 'is-drawer' : 'is-desktop'}`.trim()}
        onMouseEnter={!drawerMode ? () => setOpen(true) : undefined}
        onMouseLeave={!drawerMode ? () => setOpen(false) : undefined}
      >
        <button
          type="button"
          className={`site-nav-dropdown-trigger ${keyPrefix === 'admin' ? 'admin-menu-trigger' : 'account-menu-trigger'} ${isOpen ? 'is-open' : ''}`.trim()}
          onClick={() => {
            setOpen((current) => !current);
            if (keyPrefix === 'admin') {
              setAccountOpen(false);
            } else {
              setAdminOpen(false);
            }
          }}
          onFocus={() => !drawerMode && setOpen(true)}
          onKeyDown={(event) => handleDropdownKeyDown(event, () => setOpen(false))}
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-haspopup="menu"
        >
          <span>{label}</span>
          <span className="site-nav-dropdown-chevron" aria-hidden="true">⌄</span>
        </button>
        <div
          id={panelId}
          className={`site-nav-dropdown-panel ${keyPrefix === 'admin' ? 'admin-menu-panel' : 'account-menu-panel'} ${isOpen ? 'is-open' : ''} ${drawerMode ? 'is-drawer' : 'is-desktop'}`.trim()}
          role="menu"
          aria-label={`${label} menu`}
        >
          {/* Add future dropdown items by extending the arrays above. The shared dropdown
              renderer keeps desktop and mobile behavior aligned across the whole product. */}
          {items.map((item) => (
            <React.Fragment key={`${keyPrefix}-${item.key}`}>
              {item.dividerBefore ? <div className="account-menu-divider" role="separator" /> : null}
              {item.to ? (
                <NavLink
                  to={item.to}
                  className={`${keyPrefix === 'admin' ? 'admin-menu-item' : 'account-menu-item'} site-nav-dropdown-item`.trim()}
                  role="menuitem"
                  onClick={handlePrimaryNavClick}
                >
                  {item.label}
                </NavLink>
              ) : (
                <button
                  type="button"
                  className={`${keyPrefix === 'admin' ? 'admin-menu-item' : 'account-menu-item'} site-nav-dropdown-item is-button`.trim()}
                  role="menuitem"
                  onClick={() => {
                    handlePrimaryNavClick();
                    item.onSelect?.();
                  }}
                >
                  {item.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const renderDefaultNavItems = (drawerMode = false) => (
    <>
      {globalNavItems.map((item) => (
        <Nav.Link
          key={item.to}
          as={NavLink}
          to={item.to}
          className="site-nav-link"
          onClick={handlePrimaryNavClick}
        >
          {item.label}
        </Nav.Link>
      ))}
      <button
        type="button"
        className="site-navbar-search-trigger"
        onClick={openSearch}
        aria-label="Open search"
        aria-expanded={isSearchOpen}
      >
        <SearchIcon />
      </button>
      {currentUser ? (
        renderDropdownMenu({
          keyPrefix: 'user',
          label: 'User',
          isOpen: accountOpen,
          setOpen: setAccountOpen,
          items: userDropdownItems,
          drawerMode
        })
      ) : (
        <Nav.Link
          as={NavLink}
          to="/login"
          className="site-nav-link site-nav-cta"
          onClick={handlePrimaryNavClick}
        >
          Join tsumit
        </Nav.Link>
      )}
      {isAdminDropdownVisible ? renderDropdownMenu({
        keyPrefix: 'admin',
        label: 'Admin',
        isOpen: adminOpen,
        setOpen: setAdminOpen,
        items: adminDropdownItems,
        drawerMode
      }) : null}
    </>
  );

  const renderDesktopSearchMode = () => (
    <div className="site-navbar-search-mode" ref={searchLayerRef}>
      <div className="site-navbar-search-shell">
        <form className="site-navbar-search-form" onSubmit={submitForumSearch}>
          <SearchIcon />
          <input
            ref={searchInputRef}
            className="forum-search-input site-navbar-search-input"
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
      <button
        type="button"
        className="site-navbar-search-cancel"
        onClick={closeSearch}
      >
        Cancel
      </button>
    </div>
  );

  return (
    <>
      <Navbar
        expand="lg"
        sticky="top"
        className={`site-navbar site-navbar-global is-visible ${isScrolled ? 'is-scrolled' : ''} ${isSearchOpen ? 'is-search-mode' : ''}`.trim()}
        expanded={navExpanded}
        onToggle={(nextExpanded) => {
          setNavExpanded(Boolean(nextExpanded));
          if (nextExpanded) {
            setIsSearchOpen(false);
          }
          if (!nextExpanded) {
            closeNavOverlays();
          }
        }}
      >
        <Container className="site-navbar-inner">
          <Navbar.Brand as={NavLink} to="/" className="site-brand" aria-label="tsumit home" onClick={handlePrimaryNavClick}>
            <img src={SITE_LOGO_SRC} alt="tsumit" className="site-brand-logo" />
          </Navbar.Brand>
          <Navbar.Collapse className="site-navbar-desktop">
            <Nav className="ms-auto site-nav-group">
              {/* Search is one shared global mode. On desktop we transform the existing
                  navbar in place instead of introducing a separate search UI. */}
              {isSearchOpen && isDesktop ? renderDesktopSearchMode() : renderDefaultNavItems(false)}
            </Nav>
          </Navbar.Collapse>
          <div className="site-navbar-mobile-actions">
            <button
              type="button"
              className="site-navbar-search-trigger site-navbar-search-trigger-mobile"
              onClick={openSearch}
              aria-label="Open search"
              aria-expanded={isSearchOpen}
            >
              <SearchIcon />
            </button>
            <Navbar.Toggle aria-controls="site-mobile-nav-drawer" className="site-navbar-toggle" />
          </div>
        </Container>
      </Navbar>

      {isSearchOpen && isDesktop ? (
        <button
          type="button"
          className="site-search-focus-overlay"
          aria-label="Close search"
          onClick={closeSearch}
        />
      ) : null}

      <Offcanvas
        id="site-mobile-nav-drawer"
        show={navExpanded}
        onHide={() => {
          closeNavOverlays();
          setNavExpanded(false);
        }}
        placement="end"
        className="site-mobile-drawer site-mobile-drawer-landing"
        backdropClassName="site-mobile-drawer-backdrop site-mobile-drawer-backdrop-landing"
      >
        <Offcanvas.Header closeButton className="site-mobile-drawer-header">
          <Offcanvas.Title className="site-mobile-drawer-title">
            <img src={SITE_LOGO_SRC} alt="tsumit" className="site-mobile-brand-logo" />
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="site-mobile-drawer-body">
          <Nav className="site-nav-group is-drawer">
            {renderDefaultNavItems(true)}
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>

      <Offcanvas
        show={isSearchOpen && !isDesktop}
        onHide={closeSearch}
        placement="top"
        className="site-mobile-search-overlay"
        backdropClassName="site-mobile-search-backdrop"
      >
        <Offcanvas.Header closeButton className="site-mobile-search-header">
          <Offcanvas.Title className="site-mobile-search-title">Search</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="site-mobile-search-body">
          <div className="site-mobile-search-shell" ref={searchLayerRef}>
            {/* Search mode keeps the search layer sharp while the rest of the app
                softens behind an overlay, so attention stays anchored here. */}
            <form className="site-navbar-search-form" onSubmit={submitForumSearch}>
              <SearchIcon />
              <input
                ref={searchInputRef}
                className="forum-search-input site-navbar-search-input"
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
