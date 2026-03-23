import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { applySeo, buildCanonical, buildPageTitle, DEFAULT_DESCRIPTION } from '../lib/seo';

function routeConfig(pathname) {
  if (matchPath('/forum/post/:postId', pathname)) {
    return {
      title: buildPageTitle('Forum Post'),
      description: 'Read technical posts, practical implementation notes, and community discussion on LearnFromUs.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (
    matchPath('/forum/:forumSlug', pathname)
    || matchPath('/forum/:forumSlug/section/:sectionId', pathname)
    || pathname === '/forum'
  ) {
    return {
      title: buildPageTitle('Forum'),
      description: 'Browse engineering, AI, machine learning, analytics, and product posts organized by section and tags.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/about') {
    return {
      title: buildPageTitle('About'),
      description: 'Meet Shaohua Lu and learn why LearnFromUs was built for practical technical learning.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/login') {
    return {
      title: buildPageTitle('Login'),
      description: 'Login or create an account to publish posts, follow builders, and join the LearnFromUs forum.',
      robots: 'noindex,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (
    pathname === '/settings' ||
    pathname === '/my-posts' ||
    pathname === '/moderation' ||
    pathname === '/analytics' ||
    pathname === '/following' ||
    pathname === '/forums/request' ||
    pathname === '/goodbye' ||
    matchPath('/users/:userId', pathname)
  ) {
    return {
      title: buildPageTitle('LearnFromUs'),
      description: DEFAULT_DESCRIPTION,
      robots: 'noindex,follow',
      canonical: buildCanonical(pathname)
    };
  }

  return {
    title: buildPageTitle('Technical Forum for Builders'),
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
