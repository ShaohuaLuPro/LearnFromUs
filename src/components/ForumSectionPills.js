import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSectionLabel } from '../lib/sections';

export default function ForumSectionPills({
  sections,
  visibleCount = 3,
  className = '',
  expandedClassName = ''
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowMeta, setOverflowMeta] = useState({});
  const labelRefs = useRef(new Map());
  const normalizedSections = useMemo(
    () => (Array.isArray(sections) ? sections.filter(Boolean) : []),
    [sections]
  );
  const visibleSections = expanded
    ? normalizedSections
    : normalizedSections.slice(0, visibleCount);
  const hasOverflow = normalizedSections.length > visibleCount;
  const rootClassName = [
    'forum-section-pill-group',
    expanded ? 'is-expanded' : '',
    expanded && expandedClassName ? expandedClassName : '',
    className
  ].filter(Boolean).join(' ');
  const toggleExpanded = (event, nextValue) => {
    event.preventDefault();
    event.stopPropagation();
    setExpanded(nextValue);
  };

  useEffect(() => {
    if (normalizedSections.length === 0) {
      setOverflowMeta({});
      return undefined;
    }

    const updateOverflowState = () => {
      const nextMeta = {};

      visibleSections.forEach((section) => {
        const labelNode = labelRefs.current.get(section);
        const textNode = labelNode?.querySelector('.forum-section-pill-text');
        if (!labelNode || !textNode) {
          return;
        }

        const scrollDistance = Math.max(0, textNode.scrollWidth - labelNode.clientWidth);
        const isOverflowing = scrollDistance > 2;
        nextMeta[section] = {
          isOverflowing,
          scrollDistance,
          scrollDuration: `${Math.max(4.5, Math.min(12, scrollDistance / 22 + 4.5))}s`
        };
      });

      setOverflowMeta((current) => {
        const currentKeys = Object.keys(current);
        const nextKeys = Object.keys(nextMeta);
        if (currentKeys.length === nextKeys.length && nextKeys.every((key) => {
          const currentItem = current[key];
          const nextItem = nextMeta[key];
          return currentItem
            && currentItem.isOverflowing === nextItem.isOverflowing
            && currentItem.scrollDistance === nextItem.scrollDistance
            && currentItem.scrollDuration === nextItem.scrollDuration;
        })) {
          return current;
        }
        return nextMeta;
      });
    };

    updateOverflowState();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateOverflowState);
      return () => {
        window.removeEventListener('resize', updateOverflowState);
      };
    }

    const observer = new ResizeObserver(() => {
      updateOverflowState();
    });

    visibleSections.forEach((section) => {
      const labelNode = labelRefs.current.get(section);
      if (labelNode) {
        observer.observe(labelNode);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [normalizedSections.length, visibleSections]);

  if (normalizedSections.length === 0) {
    return null;
  }

  return (
    <div className={rootClassName}>
      <div className="forum-section-pill-row">
        {visibleSections.map((section) => (
          <span key={section} className="forum-section-pill" title={getSectionLabel(section)}>
            <span
              ref={(node) => {
                if (node) {
                  labelRefs.current.set(section, node);
                } else {
                  labelRefs.current.delete(section);
                }
              }}
              className={`forum-section-pill-label ${overflowMeta[section]?.isOverflowing ? 'is-overflowing' : ''}`.trim()}
              style={overflowMeta[section]?.isOverflowing ? {
                '--scroll-distance': `${overflowMeta[section].scrollDistance}px`,
                '--scroll-duration': overflowMeta[section].scrollDuration
              } : undefined}
            >
              <span className="forum-section-pill-text">
                {getSectionLabel(section)}
              </span>
            </span>
          </span>
        ))}
        {hasOverflow && !expanded && (
          <button
            type="button"
            className="forum-section-view-more"
            onClick={(event) => toggleExpanded(event, true)}
          >
            View more
          </button>
        )}
      </div>
      {hasOverflow && expanded && (
        <button
          type="button"
          className="forum-section-view-more is-inline"
          onClick={(event) => toggleExpanded(event, false)}
        >
          Show less
        </button>
      )}
    </div>
  );
}
