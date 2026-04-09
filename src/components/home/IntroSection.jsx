import React, { memo } from 'react';
import HomeScene from './HomeScene';
import styles from './HomePage.module.css';

function IntroSection({ content, sceneId, sceneRef, isActive }) {
  const titleLines = String(content.title || '').split('\n');
  const firstLine = titleLines[0] || '';
  const secondLine = titleLines[1] || '';
  const secondAnchorIndex = secondLine.toLowerCase().indexOf('n');
  const firstAnchorIndex = firstLine.toLowerCase().lastIndexOf('n');
  const titleAnchorPrefix = (
    firstAnchorIndex > 0
      ? firstLine.slice(0, firstAnchorIndex)
      : ''
  );
  const titleLineOffset = (
    secondAnchorIndex > 0
      ? secondLine.slice(secondAnchorIndex)
      : secondLine
  );

  return (
    <HomeScene ariaLabel="Homepage introduction" motion="section" sceneId={sceneId} sceneRef={sceneRef} isActive={isActive}>
      <div className={styles.introStage}>
        <div className={styles.introBottomImageWrap} aria-hidden="true">
          <img
            src={`${process.env.PUBLIC_URL}/images/home-1.png`}
            alt=""
            className={styles.introBottomImage}
          />
        </div>

        <div className={styles.introGrid}>
          <div>
            {content.eyebrow ? <p className={styles.eyebrow}>{content.eyebrow}</p> : null}
            <h2 className={`${styles.sectionTitle} ${styles.introHeadline}`}>
              {titleLines.length > 1 ? (
                <>
                  <span className={styles.titleLine}>{firstLine}</span>
                  <span className={styles.titleLine}>
                    <span className={styles.titleSpacer} aria-hidden="true">{titleAnchorPrefix}</span>
                    <span className={styles.titleLineOffset}>{titleLineOffset}</span>
                  </span>
                </>
              ) : (
                titleLines.map((line, index) => (
                  <span key={`${line}-${index}`} className={styles.titleLine}>
                    {line}
                  </span>
                ))
              )}
            </h2>
          </div>

          <div className={styles.introCopy}>
            {content.paragraphs.map((paragraph) => (
              <p key={paragraph} className={styles.sectionText}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </HomeScene>
  );
}

export default memo(IntroSection);
