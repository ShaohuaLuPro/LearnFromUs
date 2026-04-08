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
    title: 'Navigate',
    links: [
      { key: 'explore', href: '/explore', label: 'Explore' },
      { key: 'feed', href: '/forum', label: 'Feed' },
      { key: 'create', href: '/login', label: 'Create' },
      { key: 'about', href: '/about', label: 'About' }
    ]
  },
  {
    title: 'Company',
    links: [
      { key: 'story', href: '/origin-purpose', label: 'Why we exist' },
      { key: 'team', href: '/about/team', label: 'Team' }
    ]
  }
] as const;

export const footerLegalLinks = [
  { key: 'privacy', href: '/privacy', label: 'Privacy' },
  { key: 'terms', href: '/terms', label: 'Terms' },
  { key: 'legal', href: '/legal', label: 'Legal' }
] as const;

export const footerConnectLinks = [] as const;

export function buildFooterContent() {
  return {
    eyebrow: 'tsumit',
    title: 'Where good thinking gets shared.',
    description:
      'An AI-native platform for discovering signal, publishing with clarity, and staying close to the work worth following.',
    groups: landingFooterGroups.map((group) => ({
      ...group,
      links: [...group.links]
    })),
    connect: [...footerConnectLinks],
    legal: [...footerLegalLinks],
    brand: {
      name: 'tsumit',
      sentence: 'Built for creators, communities, and ideas that deserve more than noise.',
      copyright: `© ${new Date().getFullYear()} tsumit. All rights reserved.`
    }
  };
}
