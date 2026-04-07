import { useEffect, useState } from 'react';
import { getLandingFocusProfile, resolveLandingLayout } from '../lib/breakpoints';

function detectFoldableViewport() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return [
    '(spanning: single-fold-vertical)',
    '(spanning: single-fold-horizontal)',
    '(horizontal-viewport-segments: 2)',
    '(vertical-viewport-segments: 2)'
  ].some((query) => window.matchMedia(query).matches);
}

function readResponsiveState() {
  if (typeof window === 'undefined') {
    return {
      layout: 'desktop',
      focusProfile: getLandingFocusProfile('desktop')
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isFoldable = detectFoldableViewport();
  const layout = resolveLandingLayout(width, height, isFoldable);

  return {
    layout,
    focusProfile: getLandingFocusProfile(layout)
  };
}

export function useResponsiveLayout() {
  const [state, setState] = useState(readResponsiveState);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setState((current) => {
        const next = readResponsiveState();
        return current.layout === next.layout
          && current.focusProfile.viewportAnchor === next.focusProfile.viewportAnchor
          ? current
          : next;
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
}
