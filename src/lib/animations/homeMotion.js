// Centralized motion presets keep section behavior consistent and easy to tune.
export const REVEAL_PRESETS = {
  hero: {
    distance: 18,
    duration: 560,
    delay: 0,
    threshold: 0.28
  },
  section: {
    distance: 16,
    duration: 520,
    delay: 40,
    threshold: 0.22
  },
  card: {
    distance: 14,
    duration: 480,
    delay: 60,
    threshold: 0.18
  }
};

export function getRevealPreset(name = 'section') {
  return REVEAL_PRESETS[name] || REVEAL_PRESETS.section;
}
