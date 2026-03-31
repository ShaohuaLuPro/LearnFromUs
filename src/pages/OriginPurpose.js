import React from 'react';
import { Link } from 'react-router-dom';
import { ORIGIN_PANELS } from '../data/originPanels';

export default function OriginPurpose() {
  return (
    <div className="container page-shell about-page-shell" data-page="origin-purpose">
      <section className="panel about-origin-full h-100">
        <header className="about-section-head mb-4">
          <div className="d-flex flex-column gap-2">
            <p className="about-story-kicker about-story-kicker-highlight mb-0">Our Origin & Purpose</p>
            <h2 className="about-story-title mb-0">Built to turn shared knowledge into visible execution.</h2>
            <p className="about-story-copy mb-0">Explore the story behind Shaohua&apos;s vision, Ben&apos;s evolution, and what we focus on today.</p>
          </div>
          <Link to="/about" className="founder-link-pill text-decoration-none mt-2 align-self-start">
            ← Back
          </Link>
        </header>

        <div className="about-origin-grid">
          {ORIGIN_PANELS.map((panel) => (
            <article key={panel.key} className={`about-origin-panel about-origin-panel-${panel.key}`}>
              <div className="about-origin-copy">
                <p className="about-story-kicker mb-2">{panel.title}</p>
                <h3 className="about-story-title mb-2">{panel.lead}</h3>
                <p className="about-story-copy mb-0">{panel.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
