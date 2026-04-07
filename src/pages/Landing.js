import React, { useMemo } from 'react';
import HeroSection from '../components/home/HeroSection';
import IntroSection from '../components/home/IntroSection';
import FeatureSection from '../components/home/FeatureSection';
import ContentPreviewSection from '../components/home/ContentPreviewSection';
import CTASection from '../components/home/CTASection';
import FooterSection from '../components/home/FooterSection';
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
  const sectionIds = useMemo(
    () => ['hero', 'intro', 'features', 'preview', 'cta', 'footer'],
    []
  );
  const { activeSectionId, getSectionRef } = useCenteredSection(sectionIds, focusProfile);
  useHomeAssetPreload(content.preview.collections.map((item) => item.image));

  return (
    // Layout mode is attached at the page shell so spacing, focus softness, and
    // section height can adapt per device without scattering responsive logic.
    <div className={styles.page} data-layout={layout}>
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
        sceneRef={getSectionRef('preview')}
        isActive={activeSectionId === 'preview'}
      />
      <CTASection
        content={content.cta}
        sceneId="cta"
        sceneRef={getSectionRef('cta')}
        isActive={activeSectionId === 'cta'}
      />
      <FooterSection
        content={content.footer}
        sceneId="footer"
        sceneRef={getSectionRef('footer')}
        isActive={activeSectionId === 'footer'}
      />
    </div>
  );
}
