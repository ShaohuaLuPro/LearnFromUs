import { useCallback, useEffect, useRef, useState } from 'react';

export function useCenteredSection(sectionIds = [], options = {}) {
  const {
    viewportAnchor = 0.5
  } = options;
  const sectionMapRef = useRef(new Map());
  const frameRef = useRef(0);
  const [activeSectionId, setActiveSectionId] = useState(sectionIds[0] || null);

  const measureActiveSection = useCallback(() => {
    if (typeof window === 'undefined' || !sectionIds.length) {
      return;
    }

    const viewportCenter = window.innerHeight * viewportAnchor;
    let nextActiveId = sectionIds[0];
    let smallestDistance = Number.POSITIVE_INFINITY;

    sectionIds.forEach((sectionId) => {
      const node = sectionMapRef.current.get(sectionId);
      if (!node) {
        return;
      }

      const rect = node.getBoundingClientRect();
      const sectionCenter = rect.top + (rect.height / 2);
      const distanceToCenter = Math.abs(sectionCenter - viewportCenter);

      if (distanceToCenter < smallestDistance) {
        smallestDistance = distanceToCenter;
        nextActiveId = sectionId;
      }
    });

    setActiveSectionId((currentId) => (currentId === nextActiveId ? currentId : nextActiveId));
  }, [sectionIds, viewportAnchor]);

  const scheduleMeasurement = useCallback(() => {
    if (frameRef.current) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      measureActiveSection();
    });
  }, [measureActiveSection]);

  useEffect(() => {
    measureActiveSection();

    if (typeof window === 'undefined') {
      return undefined;
    }

    // We track the section whose midpoint is closest to a configurable viewport anchor.
    // That keeps the cinematic focus stable across desktop, tablet, mobile, and foldable
    // layouts without relying on fragile intersection timing.
    const handleScroll = () => scheduleMeasurement();
    const handleResize = () => scheduleMeasurement();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);

      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, [measureActiveSection, scheduleMeasurement]);

  const getSectionRef = useCallback(
    (sectionId) => (node) => {
      if (node) {
        sectionMapRef.current.set(sectionId, node);
      } else {
        sectionMapRef.current.delete(sectionId);
      }

      scheduleMeasurement();
    },
    [scheduleMeasurement]
  );

  return { activeSectionId, getSectionRef };
}
