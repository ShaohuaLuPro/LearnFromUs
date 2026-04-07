import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import HomeScene from './HomeScene';
import styles from './HomePage.module.css';

function actionClass(kind) {
  if (kind === 'secondary') {
    return styles.secondaryAction;
  }
  if (kind === 'text') {
    return styles.textAction;
  }
  return styles.primaryAction;
}

function HeroSection({ content, sceneId, sceneRef, isActive }) {
  return (
    <HomeScene motion="hero" ariaLabel="Homepage hero" sceneId={sceneId} sceneRef={sceneRef} isActive={isActive}>
      <p className={styles.eyebrow}>{content.eyebrow}</p>
      <div className={styles.heroGrid}>
        <div>
          <h1 className={`${styles.title} ${styles.heroTitle}`}>
            <span>{content.title.lead}</span>
            <span className={styles.heroTitleSoft}>{content.title.support}</span>
            <span className={styles.heroTitleStrong}>{content.title.emphasis}</span>
          </h1>
          <div className={styles.actionRow}>
            {content.actions.map((action) => (
              <Link key={action.key} to={action.href} className={actionClass(action.kind)}>
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.heroAside}>
          <p className={styles.heroLead}>{content.supporting}</p>
          <p className={styles.heroNote}>{content.aside}</p>
        </div>
      </div>

      <div className={styles.metricRow}>
        {content.metrics.map((metric) => (
          <article key={metric.label} className={styles.metricCard}>
            <span className={styles.metricValue}>{metric.value}</span>
            <span className={styles.metricLabel}>{metric.label}</span>
          </article>
        ))}
      </div>
    </HomeScene>
  );
}

export default memo(HeroSection);
