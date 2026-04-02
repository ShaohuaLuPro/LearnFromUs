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
    matchPath('/forum/:forumSlug/followers', pathname)
  ) {
    return {
      title: buildPageTitle('Forum Followers'),
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
      title: buildPageTitle('Forum'),
      description: 'Browse engineering, AI, machine learning, analytics, and product posts organized by section and tags.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/explore') {
    return {
      title: buildPageTitle('Explore Forums'),
      description: 'Explore all forums on LearnFromUs and discover which communities are active, popular, and worth following.',
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

  if (pathname === '/about/leadership') {
    return {
      title: buildPageTitle('Leadership'),
      description: 'Meet the leadership team behind LearnFromUs and learn who is building the platform.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/about/leadership/founder') {
    return {
      title: buildPageTitle('Founder'),
      description: 'Learn more about Shaohua Lu, founder of LearnFromUs.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/about/leadership/team-members') {
    return {
      title: buildPageTitle('Team Member'),
      description: 'Learn more about the LearnFromUs team and the people helping build the product.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/terms') {
    return {
      title: buildPageTitle('Terms of Use'),
      description: 'Read the LearnFromUs Terms of Use for community posting, account responsibilities, and platform rules.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/privacy') {
    return {
      title: buildPageTitle('Privacy Notice'),
      description: 'Read how LearnFromUs handles account, post, and community workflow data.',
      robots: 'index,follow',
      canonical: buildCanonical(pathname)
    };
  }

  if (pathname === '/legal') {
    return {
      title: buildPageTitle('Legal Information'),
      description: 'Review LearnFromUs legal information, moderation enforcement, and service disclaimers.',
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
    pathname === '/my-forums' ||
    pathname === '/my-forums/invitations' ||
    matchPath('/my-forums/:forumId/managers/:managerId', pathname) ||
    pathname === '/my-posts' ||
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
