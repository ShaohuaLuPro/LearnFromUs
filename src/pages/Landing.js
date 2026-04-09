import React, { useCallback, useMemo } from 'react';
import HeroSection from '../components/home/HeroSection';
import IntroSection from '../components/home/IntroSection';
import FeatureSection from '../components/home/FeatureSection';
import ContentPreviewSection from '../components/home/ContentPreviewSection';
import CTASection from '../components/home/CTASection';
import { buildHomeContent } from '../components/home/homeContent';
import styles from '../components/home/HomePage.module.css';
import { useHomeAssetPreload } from '../hooks/useHomeAssetPreload';
import { useCenteredSection } from '../hooks/useCenteredSection';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

export default function Landing({ currentUser, forums = [], loadingForums = false }) {
  const forumCount = forums.length;
  const sectionCount = useMemo(() => {
    const sections = new Set();

    forums.forEach((forum) => {
      (forum?.sectionScope || []).forEach((section) => {
        const normalizedSection = String(section || '').trim();
        if (normalizedSection) {
          sections.add(normalizedSection);
        }
      });
    });

    return sections.size;
  }, [forums]);

  const forumCountDisplay = loadingForums ? '...' : String(forumCount);
  const sectionCountDisplay = loadingForums ? '...' : String(sectionCount);
  const content = useMemo(
    () => buildHomeContent({ currentUser, forumCountDisplay, sectionCountDisplay }),
    [currentUser, forumCountDisplay, sectionCountDisplay]
  );
  const { layout, focusProfile } = useResponsiveLayout();
  const sectionIds = useMemo(() => ['hero', 'intro', 'features', 'preview-story', 'preview-gallery', 'cta'], []);
  const sectionNavItems = useMemo(() => ([
    { id: 'hero', label: 'Hero' },
    { id: 'intro', label: 'Intro' },
    { id: 'features', label: 'Features' },
    { id: 'preview-story', label: 'Discover' },
    { id: 'preview-gallery', label: 'Preview' },
    { id: 'cta', label: 'CTA' }
  ]), []);
  const { activeSectionId, getSectionRef } = useCenteredSection(sectionIds, focusProfile);
  useHomeAssetPreload(content.preview.collections.map((item) => item.image));

  const scrollToSection = useCallback((sectionId) => {
    if (typeof document === 'undefined') {
      return;
    }

    const target = document.querySelector(`[data-scene="${sectionId}"], [data-nav-anchor="${sectionId}"]`);
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }, []);

  return (
    // Layout mode is attached at the page shell so spacing, focus softness, and
    // section height can adapt per device without scattering responsive logic.
    <div className={styles.page} data-layout={layout}>
      <nav className={styles.sceneRail} aria-label="Homepage section navigation">
        {sectionNavItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={[
              styles.sceneRailButton,
              activeSectionId === item.id ? styles.sceneRailButtonActive : ''
            ].filter(Boolean).join(' ')}
            onClick={() => scrollToSection(item.id)}
            aria-label={`Jump to ${item.label}`}
            aria-current={activeSectionId === item.id ? 'true' : undefined}
          >
            <span className={styles.sceneRailDot} />
            <span className={styles.sceneRailLabel}>{item.label}</span>
          </button>
        ))}
      </nav>

      <HeroSection
        content={content.hero}
        sceneId="hero"
        sceneRef={getSectionRef('hero')}
        isActive={activeSectionId === 'hero'}
      />
      <IntroSection
        content={content.intro}
        sceneId="intro"
        sceneRef={getSectionRef('intro')}
        isActive={activeSectionId === 'intro'}
      />
      <FeatureSection
        content={content.features}
        sceneId="features"
        sceneRef={getSectionRef('features')}
        isActive={activeSectionId === 'features'}
      />
      <ContentPreviewSection
        content={content.preview}
        sceneId="preview"
        sceneRef={getSectionRef('preview-story')}
        storyRef={getSectionRef('preview-story')}
        galleryRef={getSectionRef('preview-gallery')}
        isActive={activeSectionId === 'preview-story' || activeSectionId === 'preview-gallery'}
      />
      <CTASection
        content={content.cta}
        sceneId="cta"
        sceneRef={getSectionRef('cta')}
        isActive={activeSectionId === 'cta'}
      />
    </div>
  );
}
