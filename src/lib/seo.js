const SITE_NAME = 'LearnFromUs';
const DEFAULT_TITLE = `${SITE_NAME} | Technical Forum for Builders`;
const DEFAULT_DESCRIPTION = 'LearnFromUs is a technical forum for engineers, AI builders, and data scientists to share practical posts, project lessons, debugging notes, and real implementation details.';

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
  canonical = 'https://shaohualupro.github.io/LearnFromUs/'
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

export { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_NAME };
