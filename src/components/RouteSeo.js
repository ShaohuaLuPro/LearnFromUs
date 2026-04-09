import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { applySeo, buildCanonical, buildPageTitle, DEFAULT_DESCRIPTION } from '../lib/seo';

function routeConfig(pathname) {
  if (matchPath('/forum/post/:postId', pathname)) {
    return {
      title: buildPageTitle('Feed Post'),
      description: 'Read technical posts, practical implementation notes, and community discussion on tsumit.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (
    matchPath('/forum/:forumSlug/followers', pathname)
  ) {
    return {
      title: buildPageTitle('Feed Followers'),
      description: DEFAULT_DESCRIPTION,
      robots: 'noindex,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (
    matchPath('/forum/:forumSlug', pathname)
    || matchPath('/forum/:forumSlug/section/:sectionId', pathname)
    || pathname === '/forum'
  ) {
    return {
      title: buildPageTitle('Feed'),
      description: 'Browse engineering, AI, machine learning, analytics, and product posts organized by section and tags.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/explore') {
    return {
      title: buildPageTitle('Discover'),
      description: 'Discover new creators and spaces on tsumit with recommendation-driven suggestions beyond who you already follow.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/about') {
    return {
      title: buildPageTitle('About'),
      description: 'Meet Shaohua Lu and learn why tsumit was built for practical technical learning.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/about/team') {
    return {
      title: buildPageTitle('Team'),
      description: 'Meet the team behind tsumit and learn who is building the platform.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/about/founder') {
    return {
      title: buildPageTitle('Founder'),
      description: 'Learn more about Shaohua Lu, founder of tsumit.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/about/ben-he') {
    return {
      title: buildPageTitle('Ben He'),
      description: 'Learn more about Ben He and the people helping build tsumit.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/about/sally-huang') {
    return {
      title: buildPageTitle('Sally Huang'),
      description: 'Learn more about Sally Huang, Digital Designer at tsumit.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/about/guotian-kan') {
    return {
      title: buildPageTitle('Guotian Kan'),
      description: 'Learn more about Guotian Kan, Data Scientist at tsumit.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/about/xiaoyu-xia') {
    return {
      title: buildPageTitle('Xiaoyu Xia'),
      description: 'Learn more about Xiaoyu Xia, Computer Scientist at tsumit.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/about/gary-huang') {
    return {
      title: buildPageTitle('Gary Huang'),
      description: 'Learn more about Gary Huang, Marketing Director at tsumit.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/terms') {
    return {
      title: buildPageTitle('Terms of Use'),
      description: 'Read the tsumit Terms of Use for community posting, account responsibilities, and platform rules.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/privacy') {
    return {
      title: buildPageTitle('Privacy Notice'),
      description: 'Read how tsumit handles account, post, and community workflow data.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/legal') {
    return {
      title: buildPageTitle('Legal Information'),
      description: 'Review tsumit legal information, moderation enforcement, and service disclaimers.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/login') {
    return {
      title: buildPageTitle('Login'),
      description: 'Login or create an account to publish posts, follow builders, and join the tsumit community.',
      robots: 'noindex,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (
    pathname === '/settings' ||
    pathname === '/my-spaces' ||
    pathname === '/my-spaces/invitations' ||
    matchPath('/my-spaces/:spaceId/manage', pathname) ||
    matchPath('/my-spaces/:forumId/managers/:managerId', pathname) ||
    pathname === '/my-forums' ||
    pathname === '/my-forums/invitations' ||
    matchPath('/my-forums/:forumId/manage', pathname) ||
    matchPath('/my-forums/:forumId/managers/:managerId', pathname) ||
    pathname === '/my-posts' ||
    matchPath('/my-posts/:postId/edit', pathname) ||
    matchPath('/my-posts/:postId/appeal', pathname) ||
    pathname === '/moderation' ||
    matchPath('/moderation/posts/:postId/appeal', pathname) ||
    pathname === '/analytics' ||
    pathname === '/admin/access' ||
    pathname === '/admin/password-reset' ||
    matchPath('/admin/access/:userId', pathname) ||
    pathname === '/following' ||
    pathname === '/forums/request' ||
    pathname === '/forums/request/history' ||
    pathname === '/forums/request/review' ||
    pathname === '/goodbye' ||
    matchPath('/users/:userId', pathname)
  ) {
    return {
      title: buildPageTitle('tsumit'),
      description: DEFAULT_DESCRIPTION,
      robots: 'noindex,follow',
      canonical: buildCanonical(pathname)
    };
  }

  return {
    title: buildPageTitle(),
    description: DEFAULT_DESCRIPTION,
    robots: 'index,follow',
    canonical: buildCanonical(pathname)
  };
}

export default function RouteSeo() {
  const location = useLocation();

  useEffect(() => {
    applySeo(routeConfig(location.pathname));
  }, [location.pathname]);

  return null;
}
