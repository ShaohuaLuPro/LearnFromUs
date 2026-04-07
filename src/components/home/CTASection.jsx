import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import HomeScene from './HomeScene';
import styles from './HomePage.module.css';

function CTASection({ content, sceneId, sceneRef, isActive }) {
  return (
    <HomeScene ariaLabel="Homepage call to action" sceneId={sceneId} sceneRef={sceneRef} isActive={isActive}>
      <div className={styles.ctaGrid}>
        <div>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{content.title}</h2>
          <p className={styles.sectionText}>{content.description}</p>
        </div>

        <div className={styles.ctaLinks}>
          {content.actions.map((action) => (
            <Link key={action.key} to={action.href} className={styles.ctaLink}>
              <span className={styles.ctaLinkEyebrow}>{action.eyebrow}</span>
              <span className={styles.ctaLinkTitle}>{action.title}</span>
              <span className={styles.ctaLinkCopy}>{action.copy}</span>
            </Link>
          ))}
        </div>
      </div>
    </HomeScene>
  );
}

export default memo(CTASection);
