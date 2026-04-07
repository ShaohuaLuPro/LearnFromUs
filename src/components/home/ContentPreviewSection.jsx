import React, { memo, useEffect, useState } from 'react';
import HomeScene from './HomeScene';
import styles from './HomePage.module.css';
import { getHomeImageProps } from '../../lib/homeMedia';

function ContentPreviewSection({ content, sceneId, sceneRef, isActive }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activePrinciple = content.principles[activeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % content.principles.length);
    }, 6200);

    return () => window.clearInterval(timer);
  }, [content.principles.length]);

  return (
    <HomeScene ariaLabel="Homepage content preview" motion="section" sceneId={sceneId} sceneRef={sceneRef} isActive={isActive}>
      <div className={styles.previewHeader}>
        <p className={styles.eyebrow}>{content.eyebrow}</p>
        <h2 className={styles.sectionTitle}>{content.title}</h2>
        <p className={styles.sectionText}>{content.description}</p>
      </div>

      <div className={styles.contentFeature}>
        <div className={styles.contentFeatureMain}>
          <p className={styles.contentFeatureEyebrow}>{activePrinciple.eyebrow}</p>
          <h3 className={styles.contentFeatureTitle}>{activePrinciple.title}</h3>
          <p className={styles.contentFeatureSummary}>{activePrinciple.summary}</p>
        </div>

        <div className={styles.contentFeatureSide}>
          {activePrinciple.body.map((paragraph) => (
            <p key={paragraph} className={styles.contentFeatureText}>{paragraph}</p>
          ))}
          <div className={styles.dotRow} role="tablist" aria-label="Homepage principle scenes">
            {content.principles.map((principle, index) => (
              <button
                key={principle.key}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Show ${principle.title}`}
                className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ''}`}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.collectionGrid}>
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
