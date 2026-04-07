import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import HomeScene from './HomeScene';
import styles from './HomePage.module.css';
import { SITE_LOGO_SRC } from '../siteChromeConfig';

function FooterSection({ content, sceneId, sceneRef, isActive }) {
  return (
    <HomeScene
      as="footer"
      ariaLabel="Homepage footer summary"
      sceneId={sceneId}
      sceneRef={sceneRef}
      isActive={isActive}
    >
      <div className={styles.footerScene}>
        <div className={styles.footerBrandBlock}>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <Link to="/" className={styles.footerBrandMark} aria-label="tsumit home">
            <img src={SITE_LOGO_SRC} alt="tsumit" className={styles.footerBrandLogo} />
            <span className={styles.footerBrandName}>{content.brand.name}</span>
          </Link>
          <h2 className={styles.footerTitle}>{content.title}</h2>
          <p className={styles.footerText}>{content.description}</p>
          <p className={styles.footerBrandStatement}>{content.brand.statement}</p>
        </div>

        <div className={styles.footerNav}>
          {content.groups.map((group) => (
            <div key={group.title} className={styles.footerLinkGroup}>
              <h3 className={styles.footerGroupTitle}>{group.title}</h3>
              <div className={styles.footerLinks}>
                {group.links.map((link) => (
                  <Link key={link.key} to={link.href} className={styles.footerLink}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className={styles.footerMetaRow}>
            <div className={styles.footerLegal}>
              {content.legal.map((link) => (
                <Link key={link.key} to={link.href} className={styles.footerLegalLink}>
                  {link.label}
                </Link>
              ))}
            </div>
            <small className={styles.footerCopyright}>{content.brand.copyright}</small>
          </div>
        </div>
      </div>
    </HomeScene>
  );
}

export default memo(FooterSection);
