import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ORIGIN_PANELS } from '../data/originPanels';

export default function OriginPurpose() {
  const [isVisionExpanded, setIsVisionExpanded] = useState(false);
  const [isEvolutionExpanded, setIsEvolutionExpanded] = useState(false);
  const [isFocusExpanded, setIsFocusExpanded] = useState(false);
  const heroHeaderRef = useRef(null);

  useEffect(() => {
    if (!heroHeaderRef.current) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    heroHeaderRef.current.focus({ preventScroll: true });
  }, []);

  return (
    <div className="container page-shell about-page-shell" data-page="origin-purpose">
      <section className="about-origin-full h-100">
        <header
          className="about-section-head about-origin-hero-head mb-4"
          ref={heroHeaderRef}
          tabIndex={-1}
        >
          <div className="d-flex flex-column">
            <nav className="about-breadcrumb" aria-label="Breadcrumb">
              <Link to="/about" className="about-breadcrumb-link text-decoration-none">
                <span className="about-breadcrumb-root">About</span>
              </Link>
              <span className="about-breadcrumb-separator" aria-hidden="true">›</span>
              <span className="about-breadcrumb-current">Why We Exist</span>
            </nav>
          </div>
        </header>

        <div className="about-origin-grid">
          {ORIGIN_PANELS.map((panel) => (
            <article key={panel.key} className={`about-origin-panel about-origin-panel-${panel.key}`}>
              <div className="about-origin-copy">
                <h3 className="about-story-title about-origin-panel-title mb-0">{panel.lead}</h3>
                {panel.key === 'vision' ? (
                  <div className="about-origin-copy-stack">
                    <p className="about-story-copy mb-0">
                      {panel.copyIntro}
                      {!isVisionExpanded ? (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="about-origin-more-btn"
                            onClick={() => setIsVisionExpanded((expanded) => !expanded)}
                          >
                            More
                          </button>
                        </>
                      ) : null}
                    </p>
                    {isVisionExpanded ? (
                      <p className="about-story-copy mb-0">
                        {panel.copyMore}{' '}
                        <button
                          type="button"
                          className="about-origin-more-btn"
                          onClick={() => setIsVisionExpanded((expanded) => !expanded)}
                        >
                          Less
                        </button>
                      </p>
                    ) : null}
                  </div>
                ) : panel.key === 'evolution' ? (
                  <div className="about-origin-copy-stack">
                    <p className="about-story-copy mb-0">
                      {panel.copyIntro}
                      {!isEvolutionExpanded ? (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="about-origin-more-btn"
                            onClick={() => setIsEvolutionExpanded((expanded) => !expanded)}
                          >
                            More
                          </button>
                        </>
                      ) : null}
                    </p>
                    {isEvolutionExpanded ? (
                      <p className="about-story-copy mb-0">
                        {panel.copyMore}{' '}
                        <button
                          type="button"
                          className="about-origin-more-btn"
                          onClick={() => setIsEvolutionExpanded((expanded) => !expanded)}
                        >
                          Less
                        </button>
                      </p>
                    ) : null}
                  </div>
                ) : panel.key === 'focus' ? (
                  <div className="about-origin-copy-stack">
                    <p className="about-story-copy mb-0">
                      {panel.copyIntro}
                      {!isFocusExpanded ? (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="about-origin-more-btn"
                            onClick={() => setIsFocusExpanded((expanded) => !expanded)}
                          >
                            More
                          </button>
                        </>
                      ) : null}
                    </p>
                    {isFocusExpanded ? (
                      <p className="about-story-copy mb-0">
                        {panel.copyMore}{' '}
                        <button
                          type="button"
                          className="about-origin-more-btn"
                          onClick={() => setIsFocusExpanded((expanded) => !expanded)}
                        >
                          Less
                        </button>
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="about-story-copy mb-0">{panel.copy}</p>
                )}
              </div>
              {panel.image ? (
                <div className="about-origin-visual">
                  <img src={panel.image} alt={panel.imageAlt} className="about-origin-image" />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
