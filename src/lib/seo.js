const SITE_NAME = 'LearnFromUs';
const DEFAULT_TITLE = `${SITE_NAME} | Technical Forum for Builders`;
const DEFAULT_DESCRIPTION = 'LearnFromUs is a technical forum for engineers, AI builders, and data scientists to share practical posts, project lessons, debugging notes, and real implementation details.';

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getRuntimeBaseUrl() {
  const configured = normalizeBaseUrl(process.env.REACT_APP_SITE_URL);
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeBaseUrl(window.location.origin);
  }

  return 'http://localhost:3000';
}

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, value);
    }
  });
}

function setCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

export function applySeo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  robots = 'index,follow',
  canonical = `${getRuntimeBaseUrl()}/`
} = {}) {
  document.title = title;
  upsertMeta('meta[name="description"]', { name: 'description', content: description });
  upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
  setCanonical(canonical);
}

export function buildPageTitle(pageTitle) {
  return pageTitle ? `${pageTitle} | ${SITE_NAME}` : DEFAULT_TITLE;
}

export function buildCanonical(pathname = '/') {
  const siteBaseUrl = getRuntimeBaseUrl();
  const normalized = String(pathname || '/').startsWith('/') ? String(pathname || '/') : `/${pathname}`;
  return normalized === '/' ? `${siteBaseUrl}/` : `${siteBaseUrl}${normalized}`;
}

export { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_NAME };
