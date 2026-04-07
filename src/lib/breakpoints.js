export const LANDING_BREAKPOINTS = {
  desktop: 1440,
  laptop: 1100,
  tablet: 768,
  mobile: 480
};

export const LANDING_LAYOUTS = {
  DESKTOP: 'desktop',
  LAPTOP: 'laptop',
  TABLET: 'tablet',
  MOBILE: 'mobile',
  FOLDABLE_COMPACT: 'foldable-compact',
  FOLDABLE_WIDE: 'foldable-wide'
};

export function resolveLandingLayout(width, height, isFoldable = false) {
  if (isFoldable) {
    return width >= LANDING_BREAKPOINTS.tablet
      ? LANDING_LAYOUTS.FOLDABLE_WIDE
      : LANDING_LAYOUTS.FOLDABLE_COMPACT;
  }

  if (width >= LANDING_BREAKPOINTS.desktop) {
    return LANDING_LAYOUTS.DESKTOP;
  }

  if (width >= LANDING_BREAKPOINTS.laptop) {
    return LANDING_LAYOUTS.LAPTOP;
  }

  if (width >= LANDING_BREAKPOINTS.tablet) {
    return LANDING_LAYOUTS.TABLET;
  }

  if (width >= LANDING_BREAKPOINTS.mobile && height <= 720) {
    return LANDING_LAYOUTS.FOLDABLE_COMPACT;
  }

  return LANDING_LAYOUTS.MOBILE;
}

export function getLandingFocusProfile(layout) {
  switch (layout) {
    case LANDING_LAYOUTS.DESKTOP:
      return { viewportAnchor: 0.5 };
    case LANDING_LAYOUTS.LAPTOP:
      return { viewportAnchor: 0.49 };
    case LANDING_LAYOUTS.TABLET:
      return { viewportAnchor: 0.48 };
    case LANDING_LAYOUTS.FOLDABLE_WIDE:
      return { viewportAnchor: 0.47 };
    case LANDING_LAYOUTS.FOLDABLE_COMPACT:
      return { viewportAnchor: 0.45 };
    case LANDING_LAYOUTS.MOBILE:
    default:
      return { viewportAnchor: 0.46 };
  }
}
