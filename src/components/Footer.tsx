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
    title: 'Why LearnFromUs',
    links: [
      { href: '/about', label: 'Our mission' },
      { href: '/about?section=leadership', label: 'Leadership' },
      { href: '/forum', label: 'Community forum' },
      { href: '/explore', label: 'Explore spaces' },
      { href: '/my-forums', label: 'My forums' },
      { href: '/explore', label: 'Success stories' },
      { href: '/about', label: 'Engineering blog' }
    ]
  },
  {
    title: 'Products and Pricing',
    links: [
      { href: '/forum/request', label: 'Request a feature' },
      { href: '/forum/request/history', label: 'Request history' },
      { href: '/following', label: 'Following feed' },
      { href: '/my-posts', label: 'My posts' },
      { href: '/about', label: 'Plans and tiers' },
      { href: '/about', label: 'Compare features' }
    ]
  },
  {
    title: 'Solutions',
    links: [
      { href: '/explore', label: 'Learning paths' },
      { href: '/forum', label: 'Discussion hubs' },
      { href: '/admin/access', label: 'Admin tools' },
      { href: '/following', label: 'Team collaboration' },
      { href: '/forum/request/review', label: 'Moderation workflow' },
      { href: '/explore', label: 'Community insights' }
    ]
  },
  {
    title: 'Resources',
    links: [
      { href: '/', label: 'Homepage' },
      { href: '/about', label: 'Documentation' },
      { href: '/forum', label: 'Quickstarts' },
      { href: '/forum/request', label: 'Support requests' },
      { href: '/forum/request/history', label: 'Release notes' },
      { href: '/about', label: 'System status' }
    ]
  },
  {
    title: 'Engage',
    links: [
      { href: '/following', label: 'Follow creators' },
      { href: '/my-forums', label: 'Create a forum' },
      { href: '/forum/request', label: 'Contact product team' },
      { href: '/forum/request/review', label: 'Become a moderator' },
      { href: '/explore', label: 'Community events' },
      { href: '/about', label: 'Partner program' }
    ]
  }
];

export default function Footer() {
  return (
    <footer className="site-footer mt-auto">
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
                  {link.href.startsWith('/') ? (
                    <Link
                      to={link.href}
                      className="footer-link"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="footer-link"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <p className="footer-note mb-0">Built by builders, for builders.</p>
        <div className="footer-legal">
          <a
            href="/about"
            className="footer-legal-link"
          >
            Terms
          </a>
          <a
            href="/about"
            className="footer-legal-link"
          >
            Privacy
          </a>
          <a
            href="/about"
            className="footer-legal-link"
          >
            Cookies
          </a>
        </div>
        <small className="footer-copyright">&copy; {new Date().getFullYear()} LearnFromUs. All rights reserved.</small>
      </div>
    </footer>
  );
}
