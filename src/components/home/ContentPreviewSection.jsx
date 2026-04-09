import React, { memo, useState } from 'react';
import HomeScene from './HomeScene';
import styles from './HomePage.module.css';
import { getHomeImageProps } from '../../lib/homeMedia';

function ContentPreviewSection({ content, sceneId, sceneRef, isActive, storyRef, galleryRef }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activePrinciple = content.principles[activeIndex];

  return (
    <HomeScene ariaLabel="Homepage content preview" motion="section" sceneId={sceneId} sceneRef={sceneRef} isActive={isActive}>
      <div className={styles.previewStoryBlock} ref={storyRef} data-nav-anchor="preview-story">
        <div className={styles.previewHeader}>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{content.title}</h2>
          <p className={styles.sectionText}>{content.description}</p>
        </div>

        <div className={styles.previewFeatureGrid}>
          <article className={styles.previewSpotlight}>
            <div className={styles.previewSpotlightHeader}>
              <p className={styles.contentFeatureEyebrow}>{activePrinciple.eyebrow}</p>
              <h3 className={styles.contentFeatureTitle}>{activePrinciple.title}</h3>
              <p className={styles.contentFeatureSummary}>{activePrinciple.summary}</p>
            </div>

            <div className={styles.previewSpotlightBody}>
              {activePrinciple.body.map((paragraph) => (
                <p key={paragraph} className={styles.contentFeatureText}>{paragraph}</p>
              ))}
            </div>

            <div className={styles.previewMetaRow} aria-label="Active principle highlights">
              {activePrinciple.meta.map((item) => (
                <span key={item} className={styles.previewMetaPill}>{item}</span>
              ))}
            </div>
          </article>

          <div className={styles.previewPrincipleList} role="tablist" aria-label="Homepage principle scenes">
            {content.principles.map((principle, index) => (
              <button
                key={principle.key}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Show ${principle.title}`}
                className={[
                  styles.previewPrincipleCard,
                  index === activeIndex ? styles.previewPrincipleCardActive : ''
                ].filter(Boolean).join(' ')}
                onClick={() => setActiveIndex(index)}
              >
                <span className={styles.previewPrincipleEyebrow}>{principle.eyebrow}</span>
                <span className={styles.previewPrincipleTitle}>{principle.title}</span>
                <span className={styles.previewPrincipleSummary}>{principle.summary}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.collectionGrid} ref={galleryRef} data-nav-anchor="preview-gallery">
        {content.collections.map((collection, index) => (
          <article key={collection.key} className={styles.collectionCard}>
            <img
              alt={`${collection.title} category`}
              className={styles.collectionImage}
              {...getHomeImageProps(collection.image, {
                eager: index < 2,
                highPriority: index === 0
              })}
            />
            <div className={styles.collectionBody}>
              <p className={styles.collectionSubtitle}>{collection.subtitle}</p>
              <h3 className={styles.collectionTitle}>{collection.title}</h3>
              <p className={styles.collectionCopy}>{collection.blurb}</p>
            </div>
          </article>
        ))}
      </div>
    </HomeScene>
  );
}

export default memo(ContentPreviewSection);
