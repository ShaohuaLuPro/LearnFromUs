import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { getExternalLinkProps } from '../../lib/links';
import HomeScene from './HomeScene';
import styles from './HomePage.module.css';

function FooterNavLink({ href, className, children }) {
  const isRouterLink = /^\/(?!\/)/.test(String(href || '').trim());

  if (!isRouterLink) {
    return (
      <a href={href} className={className} {...getExternalLinkProps(href)}>
        {children}
      </a>
    );
  }

  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

function FooterSectionContent({ content }) {
  const hasConnectLinks = Array.isArray(content.connect) && content.connect.length > 0;

  return (
    <div className={styles.footerFrame}>
      <div className={styles.footerTop}>
        <div className={styles.footerBrandBlock}>
          {content.eyebrow ? <p className={styles.footerEyebrow}>{content.eyebrow}</p> : null}
          <FooterNavLink href="/" className={styles.footerBrandMark}>
            <span className={styles.footerBrandName}>{content.brand.name}</span>
          </FooterNavLink>
          <h2 className={styles.footerTitle}>{content.title}</h2>
          <p className={styles.footerText}>{content.description}</p>
          {content.brand.sentence ? (
            <p className={styles.footerBrandSentence}>{content.brand.sentence}</p>
          ) : null}
          {hasConnectLinks ? (
            <div className={styles.footerConnectList} aria-label="Footer contact and social links">
              {content.connect.map((link) => (
                <FooterNavLink key={link.key} href={link.href} className={styles.footerConnectLink}>
                  {link.label}
                </FooterNavLink>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.footerColumns}>
          {content.groups.map((group) => (
            <div key={group.title} className={styles.footerColumn}>
              <h3 className={styles.footerColumnTitle}>{group.title}</h3>
              <div className={styles.footerLinks}>
                {group.links.map((link) => (
                  <FooterNavLink key={link.key} href={link.href} className={styles.footerLink}>
                    {link.label}
                  </FooterNavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.footerBottom}>
        <small className={styles.footerCopyright}>{content.brand.copyright}</small>
        <div className={styles.footerLegal}>
          {content.legal.map((link) => (
            <FooterNavLink key={link.key} href={link.href} className={styles.footerLegalLink}>
              {link.label}
            </FooterNavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   content: any;
 *   sceneId?: string;
 *   sceneRef?: React.RefObject<HTMLElement>;
 *   isActive?: boolean;
 *   standalone?: boolean;
 * }} props
 */
function FooterSection(props) {
  const { content, sceneId, sceneRef, isActive, standalone = false } = props;

  if (standalone) {
    return (
      <footer className={styles.footerStandalone} aria-label="Site footer">
        <div className={styles.footerStandaloneInner}>
          <FooterSectionContent content={content} />
        </div>
      </footer>
    );
  }

  return (
    <HomeScene
      as="footer"
      ariaLabel="Homepage footer summary"
      className={styles.footerSceneShell}
      sceneId={sceneId}
      sceneRef={sceneRef}
      isActive={isActive}
    >
      <FooterSectionContent content={content} />
    </HomeScene>
  );
}

export default memo(FooterSection);
