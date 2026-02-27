import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing({ currentUser }) {
  return (
    <div className="container page-shell">
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow">Technical Community</p>
          <h1 className="landing-title">A place to share what actually works.</h1>
          <p className="landing-text">
            LearnFromUs is built for engineers, data scientists, and builders who want practical ideas,
            code-driven discussions, and visible proof of execution.
          </p>
          <div className="landing-actions">
            <Link to="/forum" className="forum-primary-btn text-decoration-none">
              Explore the Forum
            </Link>
            <Link to="/about" className="forum-secondary-btn text-decoration-none">
              Meet the Founder
            </Link>
            {!currentUser && (
              <Link to="/login" className="landing-text-link text-decoration-none">
                Join and start posting
              </Link>
            )}
          </div>
        </div>

        <div className="landing-feature-panel">
          <div className="landing-stat-card">
            <span className="landing-stat-value">2</span>
            <span className="landing-stat-label">Core tracks</span>
          </div>
          <div className="landing-stat-card">
            <span className="landing-stat-value">18+</span>
            <span className="landing-stat-label">Forum sections</span>
          </div>
          <div className="landing-stat-card">
            <span className="landing-stat-value">1</span>
            <span className="landing-stat-label">Goal: better technical learning</span>
          </div>
        </div>
      </section>

      <section className="row g-4 mt-1">
        <div className="col-lg-4">
          <div className="feature-card landing-feature-card">
            <p className="landing-card-kicker">Forum</p>
            <h4>Curated by technical section</h4>
            <p className="muted mb-0">
              Browse Front End, Back End, Algorithms, AI / LLM, Statistics, and more without mixing
              everything into one noisy feed.
            </p>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="feature-card landing-feature-card">
            <p className="landing-card-kicker">Search</p>
            <h4>Find posts by real relevance</h4>
            <p className="muted mb-0">
              Search titles, content, tags, authors, and sections so useful posts are discoverable even as
              the forum grows.
            </p>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="feature-card landing-feature-card">
            <p className="landing-card-kicker">Community</p>
            <h4>Built for proof, not fluff</h4>
            <p className="muted mb-0">
              The product is designed around implementation details, practical hacks, and explanations that
              make real skill visible.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
