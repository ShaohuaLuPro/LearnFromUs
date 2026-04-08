import { resolveApiUrl } from '../api';

export function resolveHomeCollectionImage(key) {
  const cleanKey = String(key || '').trim().toLowerCase();
  if (!cleanKey) {
    return '';
  }

  return resolveApiUrl(`/api/site-media/${encodeURIComponent(cleanKey)}`);
}

export function getHomeImageProps(src, options = {}) {
  const {
    sizes = '(max-width: 480px) 100vw, (max-width: 820px) 92vw, (max-width: 1100px) 50vw, 33vw',
    eager = false,
    highPriority = false
  } = options;

  return {
    src,
    sizes,
    loading: eager ? 'eager' : 'lazy',
    fetchPriority: highPriority ? 'high' : 'auto',
    decoding: 'async'
  };
}
