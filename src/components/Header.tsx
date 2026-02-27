import React from 'react';
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
  { to: '/', label: 'Forum' },
  { to: '/about', label: 'About' }
];

type HeaderProps = {
  currentUser: CurrentUser;
  onLogout: () => void;
};

export default function Header({ currentUser, onLogout }: HeaderProps) {
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
              <>
                <span className="user-pill">Hi, {currentUser.name}</span>
                <button type="button" className="nav-action-btn" onClick={onLogout}>Logout</button>
              </>
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
