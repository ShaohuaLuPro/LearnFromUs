import { useEffect } from 'react';

export function useHomeAssetPreload(imageUrls = []) {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const links = imageUrls
      .filter(Boolean)
      .slice(0, 2)
      .map((href) => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = href;
        document.head.appendChild(link);
        return link;
      });

    return () => {
      links.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [imageUrls]);
}
