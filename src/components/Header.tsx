import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Container, Nav, Navbar, Offcanvas } from 'react-bootstrap';
import { NavLink, useNavigate } from 'react-router-dom';
import { apiGetPosts } from '../api';
import type { Forum, Post } from '../types';

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
  adminPermissions?: string[];
  hasAdminAccess?: boolean;
  canManageAdminAccess?: boolean;
} | null;

type NavItem = {
  to: string;
  label: string;
};

const navItems: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/forum', label: 'Feed' },
  { to: '/explore', label: 'Explore' },
  { to: '/about', label: 'About' }
];

const SITE_LOGO_SRC = '/images/tsumit-logo-cropped.png';

type HeaderProps = {
  currentUser: CurrentUser;
  forums: Forum[];
  posts: Post[];
  onLogout: () => void;
};

type SearchPostSuggestion = Pick<Post, 'id' | 'title' | 'content' | 'forum' | 'section' | 'tags'>;

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

export default function Header({ currentUser, forums, posts, onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const [navExpanded, setNavExpanded] = useState(false);
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [forumQuery, setForumQuery] = useState('');
  const [forumSearchOpen, setForumSearchOpen] = useState(false);
  const [remotePostMatches, setRemotePostMatches] = useState<SearchPostSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const lastScrollYRef = useRef(0);
  const navbarVisibleRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const downwardScrollDistanceRef = useRef(0);
  const upwardScrollDistanceRef = useRef(0);
  const adminCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);
  const deferredForumQuery = useDeferredValue(forumQuery);

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

  useEffect(() => {
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
  }, [deferredForumQuery]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 992px)');
    const syncDesktopNavState = (event?: MediaQueryListEvent) => {
      if (event?.matches || mediaQuery.matches) {
        if (adminCloseTimerRef.current) {
          clearTimeout(adminCloseTimerRef.current);
          adminCloseTimerRef.current = null;
        }
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
        if (searchCloseTimerRef.current) {
          clearTimeout(searchCloseTimerRef.current);
          searchCloseTimerRef.current = null;
        }
        setAdminOpen(false);
        setAccountOpen(false);
        setForumSearchOpen(false);
        setNavExpanded(false);
      }
    };

    syncDesktopNavState();
    mediaQuery.addEventListener('change', syncDesktopNavState);
    return () => mediaQuery.removeEventListener('change', syncDesktopNavState);
  }, []);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY || 0;
    navbarVisibleRef.current = true;
    downwardScrollDistanceRef.current = 0;
    upwardScrollDistanceRef.current = 0;

    const syncNavbarVisibility = () => {
      if (navExpanded) {
        if (!navbarVisibleRef.current) {
          navbarVisibleRef.current = true;
          setIsNavbarVisible(true);
        }
        lastScrollYRef.current = window.scrollY || 0;
        downwardScrollDistanceRef.current = 0;
        upwardScrollDistanceRef.current = 0;
        return;
      }

      const currentScrollY = Math.max(0, window.scrollY || 0);
      const delta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY <= 12) {
        if (!navbarVisibleRef.current) {
          navbarVisibleRef.current = true;
          setIsNavbarVisible(true);
        }
        downwardScrollDistanceRef.current = 0;
        upwardScrollDistanceRef.current = 0;
      } else if (delta > 0) {
        downwardScrollDistanceRef.current += delta;
        upwardScrollDistanceRef.current = 0;

        if (currentScrollY > 72 && downwardScrollDistanceRef.current >= 18 && navbarVisibleRef.current) {
          navbarVisibleRef.current = false;
          setIsNavbarVisible(false);
          downwardScrollDistanceRef.current = 0;
        }
      } else if (delta < 0) {
        upwardScrollDistanceRef.current += Math.abs(delta);
        downwardScrollDistanceRef.current = 0;

        if (upwardScrollDistanceRef.current >= 12 && !navbarVisibleRef.current) {
          navbarVisibleRef.current = true;
          setIsNavbarVisible(true);
          upwardScrollDistanceRef.current = 0;
        }
      }

      lastScrollYRef.current = currentScrollY;
    };

    const handleScroll = () => {
      if (scrollFrameRef.current != null) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        syncNavbarVisibility();
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollFrameRef.current != null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [navExpanded]);

  useEffect(() => {
    if (navExpanded) {
      navbarVisibleRef.current = true;
      downwardScrollDistanceRef.current = 0;
      upwardScrollDistanceRef.current = 0;
      setIsNavbarVisible(true);
    }
  }, [navExpanded]);

  const postMatches = useMemo(
    () => mergePostMatches(localPostMatches, remotePostMatches),
    [localPostMatches, remotePostMatches]
  );

  const clearAccountCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const clearAdminCloseTimer = () => {
    if (adminCloseTimerRef.current) {
      clearTimeout(adminCloseTimerRef.current);
      adminCloseTimerRef.current = null;
    }
  };

  const clearSearchCloseTimer = () => {
    if (searchCloseTimerRef.current) {
      clearTimeout(searchCloseTimerRef.current);
      searchCloseTimerRef.current = null;
    }
  };

  const openAccountMenu = () => {
    clearAccountCloseTimer();
    setAccountOpen(true);
  };

  const openAdminMenu = () => {
    clearAdminCloseTimer();
    setAdminOpen(true);
  };

  const closeAdminMenu = () => {
    clearAdminCloseTimer();
    adminCloseTimerRef.current = setTimeout(() => {
      setAdminOpen(false);
      adminCloseTimerRef.current = null;
    }, 160);
  };

  const closeAccountMenu = () => {
    clearAccountCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setAccountOpen(false);
      closeTimerRef.current = null;
    }, 160);
  };

  const openForumSearch = () => {
    clearSearchCloseTimer();
    setForumSearchOpen(true);
  };

  const closeForumSearch = () => {
    clearSearchCloseTimer();
    searchCloseTimerRef.current = setTimeout(() => {
      setForumSearchOpen(false);
      searchCloseTimerRef.current = null;
    }, 120);
  };

  const closeNavOverlays = () => {
    clearAdminCloseTimer();
    clearAccountCloseTimer();
    clearSearchCloseTimer();
    setAdminOpen(false);
    setAccountOpen(false);
    setForumSearchOpen(false);
  };

  const closeCollapsedNav = () => {
    setNavExpanded(false);
  };

  const handlePrimaryNavClick = () => {
    closeNavOverlays();
    closeCollapsedNav();
  };

  const toggleAdminMenu = () => {
    clearAccountCloseTimer();
    clearAdminCloseTimer();
    setAccountOpen(false);
    setAdminOpen((current) => !current);
  };

  const toggleAccountMenu = () => {
    clearAdminCloseTimer();
    clearAccountCloseTimer();
    setAdminOpen(false);
    setAccountOpen((current) => !current);
  };

  const goToForum = (slug: string) => {
    setForumQuery('');
    setRemotePostMatches([]);
    closeNavOverlays();
    closeCollapsedNav();
    navigate(`/forum/${slug}`);
  };

  const goToPost = (postId: string) => {
    setForumQuery('');
    setRemotePostMatches([]);
    closeNavOverlays();
    closeCollapsedNav();
    navigate(`/forum/post/${postId}`);
  };

  const submitForumSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  const showHintState = forumQuery.trim().length === 0;
  const hasResults = matchingForums.length > 0 || postMatches.length > 0;

  const renderNavItems = (drawerMode = false) => (
    <Nav className={`ms-auto site-nav-group ${drawerMode ? 'is-drawer' : ''}`.trim()}>
      <div
        className="forum-search-shell"
        onFocus={openForumSearch}
        onBlur={closeForumSearch}
      >
        <form className="forum-search-form" onSubmit={submitForumSearch}>
          <input
            className="forum-search-input"
            value={forumQuery}
            onChange={(event) => setForumQuery(event.target.value)}
            placeholder="Search spaces or posts"
            aria-label="Search spaces or posts"
          />
        </form>
        {forumSearchOpen && (
          <div className="forum-search-results">
            {showHintState ? (
              <>
                <div className="forum-search-hint">
                  Try keywords like <strong>software</strong>, <strong>ai</strong>, or a post topic.
                </div>
                {matchingForums.length > 0 && (
                  <div className="forum-search-section">
                    <div className="forum-search-section-label">Popular spaces</div>
                    {matchingForums.map((forum) => (
                      <button
                        key={forum.id}
                        type="button"
                        className="forum-search-result"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => goToForum(forum.slug)}
                      >
                        <strong>{forum.name}</strong>
                        <span>{forum.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {matchingForums.length > 0 && (
                  <div className="forum-search-section">
                    <div className="forum-search-section-label">Spaces</div>
                    {matchingForums.map((forum) => (
                      <button
                        key={forum.id}
                        type="button"
                        className="forum-search-result"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => goToForum(forum.slug)}
                      >
                        <strong>{forum.name}</strong>
                        <span>{forum.description}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchLoading ? (
                  <div className="forum-search-empty">Searching posts...</div>
                ) : postMatches.length > 0 ? (
                  <div className="forum-search-section">
                    <div className="forum-search-section-label">Posts</div>
                    {postMatches.map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        className="forum-search-result is-post"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => goToPost(post.id)}
                      >
                        <strong>{post.title}</strong>
                        <span className="forum-search-result-meta">
                          {[post.forum?.name, post.section].filter(Boolean).join(' 路 ')}
                        </span>
                        <span>{buildPostPreview(post.content)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {!searchLoading && !hasResults && (
                  <div className="forum-search-empty">No similar spaces or posts</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {navItems.map((item) => (
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
      {(currentUser?.isAdmin || currentUser?.hasAdminAccess) && (
        <div
          className="admin-menu"
          onMouseEnter={openAdminMenu}
          onMouseLeave={closeAdminMenu}
          onFocusCapture={openAdminMenu}
          onBlurCapture={closeAdminMenu}
        >
          <button
            type="button"
            className="admin-menu-trigger"
            onClick={toggleAdminMenu}
            aria-expanded={adminOpen}
          >
            Admin
          </button>
          <div className={`admin-menu-panel ${adminOpen ? 'is-open' : ''}`}>
            {(currentUser.isAdmin || currentUser.adminPermissions?.includes('moderation')) && (
              <NavLink
                to="/moderation"
                className="admin-menu-item"
                onClick={() => {
                  setAdminOpen(false);
                  closeCollapsedNav();
                }}
              >
                Moderation
              </NavLink>
            )}
            {(currentUser.isAdmin || currentUser.adminPermissions?.includes('forum_requests')) && (
              <NavLink
                to="/forums/request/review"
                className="admin-menu-item"
                onClick={() => {
                  setAdminOpen(false);
                  closeCollapsedNav();
                }}
              >
                Space Requests
              </NavLink>
            )}
            {(currentUser.isAdmin || currentUser.adminPermissions?.includes('analytics')) && (
              <NavLink
                to="/analytics"
                className="admin-menu-item"
                onClick={() => {
                  setAdminOpen(false);
                  closeCollapsedNav();
                }}
              >
                Analytics
              </NavLink>
            )}
            {(currentUser.isAdmin || currentUser.adminPermissions?.includes('password_reset')) && (
              <NavLink
                to="/admin/password-reset"
                className="admin-menu-item"
                onClick={() => {
                  setAdminOpen(false);
                  closeCollapsedNav();
                }}
              >
                Password Reset
              </NavLink>
            )}
            {currentUser.canManageAdminAccess && (
              <NavLink
                to="/admin/access"
                className="admin-menu-item"
                onClick={() => {
                  setAdminOpen(false);
                  closeCollapsedNav();
                }}
              >
                Admin Management
              </NavLink>
            )}
          </div>
        </div>
      )}
      {currentUser ? (
        <div
          className="account-menu"
          onMouseEnter={openAccountMenu}
          onMouseLeave={closeAccountMenu}
          onFocusCapture={openAccountMenu}
          onBlurCapture={closeAccountMenu}
        >
          <button
            type="button"
            className="account-menu-trigger"
            onClick={toggleAccountMenu}
            aria-expanded={accountOpen}
          >
            Hi, {currentUser.name}
          </button>
          <div className={`account-menu-panel ${accountOpen ? 'is-open' : ''}`}>
            <NavLink
              to={`/users/${currentUser.id}`}
              className="account-menu-item"
              onClick={() => {
                setAccountOpen(false);
                closeCollapsedNav();
              }}
            >
              My Profile
            </NavLink>
            <NavLink
              to="/my-posts"
              className="account-menu-item"
              onClick={() => {
                setAccountOpen(false);
                closeCollapsedNav();
              }}
            >
              My Posts
            </NavLink>
            <NavLink
              to="/my-forums"
              className="account-menu-item"
              onClick={() => {
                setAccountOpen(false);
                closeCollapsedNav();
              }}
            >
              My Spaces
            </NavLink>
            <NavLink
              to="/following"
              className="account-menu-item"
              onClick={() => {
                setAccountOpen(false);
                closeCollapsedNav();
              }}
            >
              Following
            </NavLink>
            <NavLink
              to="/settings"
              className="account-menu-item"
              onClick={() => {
                setAccountOpen(false);
                closeCollapsedNav();
              }}
            >
              Settings
            </NavLink>
            <div className="account-menu-divider" />
            <button
              type="button"
              className="account-menu-item is-button"
              onClick={() => {
                setAccountOpen(false);
                closeCollapsedNav();
                onLogout();
              }}
            >
              Logout
            </button>
          </div>
        </div>
      ) : (
        <Nav.Link
          as={NavLink}
          to="/login"
          className="site-nav-link"
          onClick={handlePrimaryNavClick}
        >
          Login
        </Nav.Link>
      )}
    </Nav>
  );

  return (
    <Navbar
      expand="lg"
      sticky="top"
      className={`site-navbar ${isNavbarVisible ? 'is-visible' : 'is-hidden'}`.trim()}
      expanded={navExpanded}
      onToggle={(nextExpanded) => {
        setNavExpanded(Boolean(nextExpanded));
        if (!nextExpanded) {
          closeNavOverlays();
        }
      }}
    >
      <Container className="site-navbar-inner">
        <Navbar.Brand as={NavLink} to="/" className="site-brand" aria-label="tsumit home">
          <img src={SITE_LOGO_SRC} alt="tsumit" className="site-brand-logo" />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="site-mobile-nav-drawer" className="site-navbar-toggle" />
        <Navbar.Collapse className="site-navbar-desktop">
          {renderNavItems()}
        </Navbar.Collapse>
      </Container>
      <Offcanvas
        id="site-mobile-nav-drawer"
        show={navExpanded}
        onHide={() => {
          closeNavOverlays();
          setNavExpanded(false);
        }}
        placement="end"
        className="site-mobile-drawer"
        backdropClassName="site-mobile-drawer-backdrop"
      >
        <Offcanvas.Header closeButton className="site-mobile-drawer-header">
          <Offcanvas.Title className="site-mobile-drawer-title">
            <img src={SITE_LOGO_SRC} alt="tsumit" className="site-mobile-brand-logo" />
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="site-mobile-drawer-body">
          {renderNavItems(true)}
        </Offcanvas.Body>
      </Offcanvas>
    </Navbar>
  );
}
