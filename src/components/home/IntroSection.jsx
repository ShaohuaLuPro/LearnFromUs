import React, { memo } from 'react';
import HomeScene from './HomeScene';
import styles from './HomePage.module.css';

function IntroSection({ content, sceneId, sceneRef, isActive }) {
  return (
    <HomeScene ariaLabel="Homepage introduction" motion="section" sceneId={sceneId} sceneRef={sceneRef} isActive={isActive}>
      <div className={styles.introGrid}>
        <div>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{content.title}</h2>
        </div>

        <div className={styles.introCopy}>
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph} className={styles.sectionText}>{paragraph}</p>
          ))}
        </div>
      </div>
    </HomeScene>
  );
}

export default memo(IntroSection);
