import React, { memo } from 'react';
import HomeScene from './HomeScene';
import styles from './HomePage.module.css';

function FeatureSection({ content, sceneId, sceneRef, isActive }) {
  return (
    <HomeScene
      ariaLabel="Homepage feature section"
      sceneId={sceneId}
      sceneRef={sceneRef}
      isActive={isActive}
      className={styles.featureScene}
    >
      <div className={styles.featureStack}>
        <div className={styles.previewHeader}>
          {content.eyebrow ? <p className={styles.eyebrow}>{content.eyebrow}</p> : null}
          <h2 className={styles.sectionTitle}>{content.title}</h2>
          {content.description ? <p className={styles.sectionText}>{content.description}</p> : null}
        </div>

        {content.cards.length ? (
          <div className={styles.featureGrid}>
            {content.cards.map((card) => (
              <article
                key={card.key}
                className={[
                  styles.featureCard,
                  styles[`featureCardTone${card.tone.charAt(0).toUpperCase()}${card.tone.slice(1)}`] || ''
                ].filter(Boolean).join(' ')}
              >
                <img
                  src={card.image}
                  alt={card.imageAlt}
                  className={styles.featureCardImage}
                  style={{
                    objectPosition: card.imagePosition || 'center center'
                  }}
                  loading="lazy"
                />
                <div className={styles.featureCardOverlay}>
                  <div className={styles.featureCardHeader}>
                    <h3 className={styles.featureCardTitle}>{card.title}</h3>
                  </div>
                  <div className={styles.featureCardBody}>
                    {card.copy ? <p className={styles.featureCardCopy}>{card.copy}</p> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </HomeScene>
  );
}

export default memo(FeatureSection);
