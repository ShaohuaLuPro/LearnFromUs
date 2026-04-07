export const SITE_LOGO_SRC = '/images/tsumit-lockup-minimal.svg';
export const SITE_ICON_SRC = '/images/tsumit-icon-minimal.svg';

export type SiteNavItem = {
  to: string;
  label: string;
};

export const globalNavItems = [
  { to: '/explore', label: 'Explore' },
  { to: '/forum', label: 'Feed' },
  { to: '/about', label: 'About' }
] as const;

export const GLOBAL_SEARCH_PLACEHOLDER = 'Search spaces or posts';

export const GLOBAL_SEARCH_SUGGESTIONS = [
  { key: 'software', label: 'Software systems' },
  { key: 'ai', label: 'AI workflows' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'housing', label: 'Home & living' }
] as const;

export const GLOBAL_SEARCH_QUICK_LINKS = [
  { key: 'explore', label: 'Explore spaces', to: '/explore' },
  { key: 'feed', label: 'Browse the feed', to: '/forum' },
  { key: 'about', label: 'About tsumit', to: '/about' }
] as const;

export const landingFooterGroups = [
  {
    title: 'Explore',
    links: [
      { key: 'spaces', href: '/explore', label: 'Browse spaces' },
      { key: 'feed', href: '/forum', label: 'See the feed' }
    ]
  },
  {
    title: 'Learn More',
    links: [
      { key: 'about', href: '/about', label: 'About tsumit' },
      { key: 'story', href: '/about/why-we-exist', label: 'Why we exist' }
    ]
  }
] as const;

export const footerLegalLinks = [
  { key: 'terms', href: '/terms', label: 'Terms' },
  { key: 'privacy', href: '/privacy', label: 'Privacy' },
  { key: 'legal', href: '/legal', label: 'Legal' }
] as const;
