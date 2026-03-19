export function isExternalHref(href) {
  const value = String(href || '').trim();
  if (!value) {
    return false;
  }

  if (/^(mailto:|tel:|#|\/(?!\/))/i.test(value)) {
    return false;
  }

  try {
    const baseOrigin = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost';
    const url = new URL(value, baseOrigin);
    return /^(http:|https:)$/i.test(url.protocol) && url.origin !== baseOrigin;
  } catch (_) {
    return false;
  }
}

export function getExternalLinkProps(href) {
  return isExternalHref(href)
    ? { target: '_blank', rel: 'noreferrer' }
    : {};
}
