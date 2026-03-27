import React from 'react';
import { Link } from 'react-router-dom';

const INDUSTRY_CARDS = [
  {
    key: 'housing',
    title: 'Housing',
    subtitle: 'Home & Living',
    image:
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'
  },
  {
    key: 'sports',
    title: 'Sports',
    subtitle: 'Fitness & Training',
    image:
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80'
  },
  {
    key: 'social',
    title: 'Social',
    subtitle: 'Community & Dating',
    image:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80'
  },
  {
    key: 'ai',
    title: 'AI',
    subtitle: 'Artificial Intelligence',
    image:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80'
  },
  {
    key: 'food',
    title: 'Food',
    subtitle: 'Nutrition & Cooking',
    image:
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80'
  },
  {
    key: 'transport',
    title: 'Transport',
    subtitle: 'Travel & Mobility',
    image:
      'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1200&q=80'
  }
];

export default function Landing({ currentUser }) {
  return (
    <div className="container page-shell">
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow type-kicker">Technical Community</p>
          <h1 className="landing-title type-title-lg">A place to share what actually works.</h1>
          <p className="landing-text type-body">
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
            <p className="landing-card-kicker type-kicker">Forum</p>
            <h4 className="type-title-md">Curated by technical section</h4>
            <p className="type-body mb-0">
              Browse Front End, Back End, Algorithms, AI / LLM, Statistics, and more without mixing
              everything into one noisy feed.
            </p>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="feature-card landing-feature-card">
            <p className="landing-card-kicker type-kicker">Search</p>
            <h4 className="type-title-md">Find posts by real relevance</h4>
            <p className="type-body mb-0">
              Search titles, content, tags, authors, and sections so useful posts are discoverable even as
              the forum grows.
            </p>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="feature-card landing-feature-card">
            <p className="landing-card-kicker type-kicker">Community</p>
            <h4 className="type-title-md">Built for proof, not fluff</h4>
            <p className="type-body mb-0">
              The product is designed around implementation details, practical hacks, and explanations that
              make real skill visible.
            </p>
          </div>
        </div>
      </section>

      <section className="industry-gallery mt-4" aria-label="Industry gallery">
        {INDUSTRY_CARDS.map((card) => (
          <article key={card.key} className="industry-card">
            <img src={card.image} alt={`${card.title} industry`} className="industry-card-image" loading="lazy" />
            <div className="industry-card-overlay" />
            <div className="industry-card-content">
              <h3 className="industry-card-title mb-1">{card.title}</h3>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
