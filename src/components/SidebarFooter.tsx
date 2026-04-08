import React from 'react';
import { Link } from 'react-router-dom';

type SidebarFooterProps = {
  collapsed?: boolean;
  isDrawer?: boolean;
};

const sidebarFooterLinks = [
  { key: 'about', to: '/about', label: 'About' },
  { key: 'team', to: '/about/team', label: 'Team' },
  { key: 'why', to: '/origin-purpose', label: 'Why we exist' },
  { key: 'privacy', to: '/privacy', label: 'Privacy' },
  { key: 'terms', to: '/terms', label: 'Terms' }
] as const;

export default function SidebarFooter({ collapsed = false, isDrawer = false }: SidebarFooterProps) {
  const showExtendedContent = !collapsed || isDrawer;

  return (
    <section
      className={`platform-sidebar-footer ${collapsed && !isDrawer ? 'is-collapsed' : ''} ${isDrawer ? 'is-drawer' : ''}`.trim()}
      aria-label="Sidebar footer"
    >
      <Link to="/" className="platform-sidebar-footer-brand">
        tsumit
      </Link>

      {showExtendedContent ? (
        <>
          <p className="platform-sidebar-footer-copy">Where good thinking gets shared.</p>
          <nav className="platform-sidebar-footer-links" aria-label="Sidebar footer links">
            {sidebarFooterLinks.map((link) => (
              <Link key={link.key} to={link.to} className="platform-sidebar-footer-link">
                {link.label}
              </Link>
            ))}
          </nav>
          <small className="platform-sidebar-footer-meta">© {new Date().getFullYear()} tsumit</small>
        </>
      ) : null}
    </section>
  );
}
