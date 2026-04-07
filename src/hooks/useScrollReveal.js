import { useEffect, useRef, useState } from 'react';

export function useScrollReveal(options = {}) {
  const {
    threshold = 0.01,
    rootMargin = '0px 0px 45% 0px',
    once = true
  } = options;
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }

    // We activate sections well before they enter the viewport so fast scrolling
    // never leaves users staring at empty gaps while an animation catches up.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            setIsVisible(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);

  return { ref, isVisible };
}
