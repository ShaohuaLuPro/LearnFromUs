import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Container, Nav, Navbar } from 'react-bootstrap';
import { NavLink, useNavigate } from 'react-router-dom';
import { apiGetPosts } from '../api';
import type { Forum, Post } from '../types';

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
} | null;

type NavItem = {
  to: string;
  label: string;
};

const navItems: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/forum', label: 'Forum' },
  { to: '/about', label: 'About' }
];

type HeaderProps = {
  currentUser: CurrentUser;
  forums: Forum[];
  onLogout: () => void;
};

type SearchPostSuggestion = Pick<Post, 'id' | 'title' | 'content' | 'forum' | 'section'>;

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

export default function Header({ currentUser, forums, onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [forumQuery, setForumQuery] = useState('');
  const [forumSearchOpen, setForumSearchOpen] = useState(false);
  const [postMatches, setPostMatches] = useState<SearchPostSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
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

  useEffect(() => {
    const query = deferredForumQuery.trim();
    if (query.length < 2) {
      setPostMatches([]);
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
          pageSize: 4
        });
        if (searchRequestIdRef.current === requestId) {
          setPostMatches(response.posts || []);
        }
      } catch (error) {
        if (searchRequestIdRef.current === requestId) {
          setPostMatches([]);
        }
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setSearchLoading(false);
        }
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [deferredForumQuery]);

  const openAccountMenu = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setAccountOpen(true);
  };

  const closeAccountMenu = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setAccountOpen(false);
      closeTimerRef.current = null;
    }, 160);
  };

  const openForumSearch = () => {
    if (searchCloseTimerRef.current) {
      clearTimeout(searchCloseTimerRef.current);
      searchCloseTimerRef.current = null;
    }
    setForumSearchOpen(true);
  };

  const closeForumSearch = () => {
    if (searchCloseTimerRef.current) {
      clearTimeout(searchCloseTimerRef.current);
    }
    searchCloseTimerRef.current = setTimeout(() => {
      setForumSearchOpen(false);
      searchCloseTimerRef.current = null;
    }, 120);
  };

  const goToForum = (slug: string) => {
    setForumQuery('');
    setPostMatches([]);
    setForumSearchOpen(false);
    navigate(`/forum/${slug}`);
  };

  const goToPost = (postId: string) => {
    setForumQuery('');
    setPostMatches([]);
    setForumSearchOpen(false);
    navigate(`/forum/post/${postId}`);
  };

  const submitForumSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstForum = matchingForums[0];
    if (firstForum) {
      goToForum(firstForum.slug);
      return;
    }

    const firstPost = postMatches[0];
    if (firstPost) {
      goToPost(firstPost.id);
    }
  };

  const showHintState = forumQuery.trim().length === 0;
  const hasResults = matchingForums.length > 0 || postMatches.length > 0;

  return (
    <Navbar expand="lg" sticky="top" className="site-navbar">
      <Container className="site-navbar-inner">
        <Navbar.Brand as={NavLink} to="/" className="site-brand">
          <span className="brand-dot" />
          LearnFromUs
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="ms-auto site-nav-group">
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
                  placeholder="Search forums or posts"
                  aria-label="Search forums or posts"
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
                          <div className="forum-search-section-label">Popular forums</div>
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
                          <div className="forum-search-section-label">Forums</div>
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
                                {[post.forum?.name, post.section].filter(Boolean).join(' · ')}
                              </span>
                              <span>{buildPostPreview(post.content)}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {!searchLoading && !hasResults && (
                        <div className="forum-search-empty">No similar forums or posts</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            {navItems.map((item) => (
              <Nav.Link key={item.to} as={NavLink} to={item.to} className="site-nav-link">
                {item.label}
              </Nav.Link>
            ))}
            {currentUser ? (
              <div
                className="account-menu"
                onMouseEnter={openAccountMenu}
                onMouseLeave={closeAccountMenu}
              >
                <button type="button" className="account-menu-trigger">
                  Hi, {currentUser.name}
                </button>
                <div className={`account-menu-panel ${accountOpen ? 'is-open' : ''}`}>
                  <NavLink to={`/users/${currentUser.id}`} className="account-menu-item" onClick={() => setAccountOpen(false)}>
                    My Profile
                  </NavLink>
                  <NavLink to="/my-posts" className="account-menu-item" onClick={() => setAccountOpen(false)}>
                    My Posts
                  </NavLink>
                  <NavLink to="/following" className="account-menu-item" onClick={() => setAccountOpen(false)}>
                    Following
                  </NavLink>
                  {currentUser.isAdmin && (
                    <NavLink to="/moderation" className="account-menu-item" onClick={() => setAccountOpen(false)}>
                      Moderation
                    </NavLink>
                  )}
                  {currentUser.isAdmin && (
                    <NavLink to="/analytics" className="account-menu-item" onClick={() => setAccountOpen(false)}>
                      Analytics
                    </NavLink>
                  )}
                  <NavLink to="/settings" className="account-menu-item" onClick={() => setAccountOpen(false)}>
                    Settings
                  </NavLink>
                  <div className="account-menu-divider" />
                  <button type="button" className="account-menu-item is-button" onClick={onLogout}>
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <Nav.Link as={NavLink} to="/login" className="site-nav-link">
                Login
              </Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
