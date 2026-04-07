import React, { useCallback } from 'react';
import styles from './HomePage.module.css';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { getRevealPreset } from '../../lib/animations/homeMotion';

export default function HomeScene({
  children,
  className = '',
  motion = 'section',
  as: Component = 'section',
  ariaLabel,
  sceneId,
  sceneRef,
  isActive = false
}) {
  const preset = getRevealPreset(motion);
  const { ref, isVisible } = useScrollReveal({ threshold: preset.threshold });
  const motionClass = motion === 'hero'
    ? styles.revealHero
    : motion === 'card'
      ? styles.revealCard
      : styles.revealSection;
  const setRefs = useCallback(
    (node) => {
      ref.current = node;
      if (typeof sceneRef === 'function') {
        sceneRef(node);
      }
    },
    [sceneRef, ref]
  );

  return (
    <Component
      ref={setRefs}
      aria-label={ariaLabel}
      data-scene={sceneId}
      data-active={isActive ? 'true' : 'false'}
      className={[
        styles.scene,
        isActive ? styles.sceneActive : styles.sceneInactive,
        styles.reveal,
        motionClass,
        isVisible ? styles.isVisible : '',
        className
      ].filter(Boolean).join(' ')}
    >
      {/* Sections stay mounted and readable at all times. Scroll focus only adjusts
          emphasis, so rapid scrolling never produces blank scenes or late-mounted content. */}
      <div className={styles.sceneInner}>{children}</div>
    </Component>
  );
}
