import React from 'react';

type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

const links: FooterLink[] = [
  { href: '/LearnFromUs', label: 'Home' },
  { href: '/LearnFromUs/forum', label: 'Forum' },
  { href: '/LearnFromUs/about', label: 'About' }
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
              <a
                key={link.href}
                href={link.href}
                className="footer-link"
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noreferrer' : undefined}
              >
                {link.label}
              </a>
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
