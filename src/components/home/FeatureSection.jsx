import React, { memo } from 'react';
import HomeScene from './HomeScene';
import styles from './HomePage.module.css';

function FeatureSection({ content, sceneId, sceneRef, isActive }) {
  return (
    <HomeScene ariaLabel="Homepage feature section" sceneId={sceneId} sceneRef={sceneRef} isActive={isActive}>
      <div className={styles.previewHeader}>
        <p className={styles.eyebrow}>{content.eyebrow}</p>
        <h2 className={styles.sectionTitle}>{content.title}</h2>
        <p className={styles.sectionText}>{content.description}</p>
      </div>

      <div className={styles.featureGrid}>
        {content.cards.map((card) => (
          <article key={card.key} className={styles.featureCard}>
            <h3 className={styles.featureCardTitle}>{card.title}</h3>
            <p className={styles.featureCardCopy}>{card.copy}</p>
          </article>
        ))}
      </div>
    </HomeScene>
  );
}

export default memo(FeatureSection);
