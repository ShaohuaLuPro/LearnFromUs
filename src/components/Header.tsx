import React, { useRef, useState } from 'react';
import { Container, Nav, Navbar } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';

type CurrentUser = {
  id: string;
  name: string;
  email: string;
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
  onLogout: () => void;
};

export default function Header({ currentUser, onLogout }: HeaderProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
