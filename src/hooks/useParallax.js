import { useEffect, useRef } from 'react';

export function useParallax(options = {}) {
  const {
    speed = 0.04,
    maxOffset = 28,
    enabled = true
  } = options;
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === 'undefined' || !enabled) {
      return undefined;
    }

    let frameId = 0;

    const update = () => {
      const rect = node.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const distance = elementCenter - viewportCenter;
      const nextOffset = Math.max(-maxOffset, Math.min(maxOffset, distance * speed * -1));
      node.style.setProperty('--parallax-y', `${nextOffset.toFixed(2)}px`);
      frameId = 0;
    };

    const schedule = () => {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, maxOffset, speed]);

  return ref;
}
