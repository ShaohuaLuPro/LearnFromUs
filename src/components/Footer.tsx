import React from 'react';
import { Link } from 'react-router-dom';

type FooterLink = {
  href: string;
  label: string;
};

type FooterSection = {
  title: string;
  links: FooterLink[];
};

const footerSections: FooterSection[] = [
  {
    title: 'Start Here',
    links: [
      { href: '/', label: 'Homepage' },
      { href: '/explore', label: 'Explore' },
      { href: '/forum', label: 'Forum Feed' },
      { href: '/about', label: 'About' },
      { href: '/about?section=leadership', label: 'Leadership' }
    ]
  },
  {
    title: 'Build and Share',
    links: [
      { href: '/my-posts', label: 'My Posts' },
      { href: '/my-forums', label: 'My Forums' },
      { href: '/my-forums/invitations', label: 'Forum Invitations' },
      { href: '/forums/request', label: 'Request a feature' },
      { href: '/forums/request/history', label: 'Request history' },
      { href: '/forum', label: 'Create in Forum' }
    ]
  },
  {
    title: 'Community',
    links: [
      { href: '/following', label: 'Following Feed' },
      { href: '/forum', label: 'Browse Discussions' },
      { href: 'mailto:tomlu1234567@gmail.com', label: 'Contact Product Team' }
    ]
  },
  {
    title: 'Account',
    links: [
      { href: '/login', label: 'Login' },
      { href: '/settings', label: 'Settings' },
      { href: '/my-posts', label: 'My Activity' },
      { href: '/goodbye', label: 'Goodbye Page' }
    ]
  }
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        {footerSections.map((section) => (
          <div
            key={section.title}
            className="footer-column"
          >
            <h3 className="footer-title">{section.title}</h3>
            <ul className="footer-list">
              {section.links.map((link) => (
                <li key={`${section.title}-${link.label}`}>
                  {link.href.startsWith('mailto:') ? (
                    <a
                      href={link.href}
                      className="footer-link"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.href}
                      className="footer-link"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <p className="footer-note mb-0">Built by builders, for builders. Some links require sign-in or admin permissions.</p>
        <div className="footer-legal">
          <Link to="/terms" className="footer-legal-link">
            Terms
          </Link>
          <Link to="/privacy" className="footer-legal-link">
            Privacy
          </Link>
          <Link to="/legal" className="footer-legal-link">
            Legal
          </Link>
        </div>
        <small className="footer-copyright">&copy; {new Date().getFullYear()} LearnFromUs. All rights reserved.</small>
      </div>
    </footer>
  );
}
