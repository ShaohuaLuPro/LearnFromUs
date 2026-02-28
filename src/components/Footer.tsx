import React from 'react';
import { Link } from 'react-router-dom';

type FooterLink = {
  to: string;
  label: string;
};

const links: FooterLink[] = [
  { to: '/', label: 'Home' },
  { to: '/forum', label: 'Forum' },
  { to: '/about', label: 'About' }
];

export default function Footer() {
  return (
    <footer className="site-footer mt-auto">
      <div className="container footer-shell">
        <div className="footer-left">
          <p className="footer-title mb-1">LearnFromUs Community</p>
          <p className="mb-0 muted">A forum for coding hacks, product lessons, and builder discussions.</p>
        </div>
        <div className="footer-right">
          <p className="mb-2 muted">Built for builders shipping real work.</p>
          <div className="footer-links">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="footer-link"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <small className="muted">&copy; {new Date().getFullYear()} LearnFromUs. All rights reserved.</small>
      </div>
    </footer>
  );
}
