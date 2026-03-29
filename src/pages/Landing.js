import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

const INDUSTRY_CARDS = [
  {
    key: 'housing',
    title: 'Housing',
    subtitle: 'Home & Living',
    blurb: 'Practical systems for better daily living and smarter decisions at home.',
    image:
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'
  },
  {
    key: 'sports',
    title: 'Sports',
    subtitle: 'Fitness & Training',
    blurb: 'Actionable training insights focused on consistency, progress, and execution.',
    image:
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80'
  },
  {
    key: 'social',
    title: 'Social',
    subtitle: 'Community & Dating',
    blurb: 'Real-world communication and relationship strategies that actually work.',
    image:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80'
  },
  {
    key: 'ai',
    title: 'AI',
    subtitle: 'Artificial Intelligence',
    blurb: 'From prompts to production, learn AI workflows built around practical outcomes.',
    image:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80'
  },
  {
    key: 'food',
    title: 'Food',
    subtitle: 'Nutrition & Cooking',
    blurb: 'Build sustainable food habits with practical nutrition and cooking guidance.',
    image:
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80'
  },
  {
    key: 'transport',
    title: 'Transport',
    subtitle: 'Travel & Mobility',
    blurb: 'Move smarter with tactical travel and mobility insights from lived experience.',
    image:
      'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1200&q=80'
  }
];

export default function Landing({ currentUser, forums = [], loadingForums = false }) {
  const forumCount = forums.length;
  const sectionCount = useMemo(() => {
    const sections = new Set();

    forums.forEach((forum) => {
      (forum?.sectionScope || []).forEach((section) => {
        const normalizedSection = String(section || '').trim();
        if (normalizedSection) {
          sections.add(normalizedSection);
        }
      });
    });

    return sections.size;
  }, [forums]);

  const forumCountDisplay = loadingForums ? '...' : String(forumCount);
  const sectionCountDisplay = loadingForums ? '...' : String(sectionCount);

  return (
    <div className="container page-shell">
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow type-kicker">A Forum For Doers</p>
          <h1 className="landing-title landing-title-two-line type-title-lg">
            <span className="about-story-hero-title-main">Most platforms are full of opinions.</span>
            <span className="about-story-hero-title-em">
              <span className="landing-em-no-break">Very few show <span className="about-word-bounce about-word-bounce-delay-0">real</span>{' '}
              <span className="about-word-bounce about-word-bounce-delay-1">execution</span>.</span>
            </span>
          </h1>
          <p className="landing-text type-body">
            Real experience beats opinions.
            <br />
            Execution is visible.
            <br />
            Useful knowledge compounds — across software, fitness, and everyday life.
          </p>
          <div className="landing-actions">
            <Link to="/forum" className="forum-primary-btn text-decoration-none">
              Explore the Forum
            </Link>
            <Link to="/about" className="forum-secondary-btn text-decoration-none">
              Learn About Us
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
            <span className="landing-stat-value">{forumCountDisplay}</span>
            <span className="landing-stat-label">Active forums</span>
          </div>
          <div className="landing-stat-card">
            <span className="landing-stat-value">{sectionCountDisplay}</span>
            <span className="landing-stat-label">Forum sections</span>
          </div>
          <div className="landing-stat-card">
            <span className="landing-stat-value">1</span>
            <span className="landing-stat-label">Focus: Real Execution</span>
          </div>
        </div>
      </section>

      <section className="row g-4 mt-1 landing-feature-stack">
        <div className="col-12">
          <div className="feature-card landing-feature-card">
            <p className="landing-card-kicker type-kicker">Forum</p>
            <h4 className="type-title-md">Curated by topics</h4>
            <p className="type-body mb-2">
              Explore ideas, systems, and real-world practices across a wide range of topics — thoughtfully organized
              so you can focus on what matters, without the noise.
            </p>
            <p className="type-body mb-0">
              Every section is designed to surface signal over chatter, helping you discover knowledge that&apos;s
              grounded in experience, not just opinion.
            </p>
          </div>
        </div>
        <div className="col-12">
          <div className="feature-card landing-feature-card">
            <p className="landing-card-kicker type-kicker">Search</p>
            <h4 className="type-title-md">Find posts by real relevance</h4>
            <p className="type-body mb-2">
              Search across titles, content, tags, authors, and topics — with results ranked by meaning, not just
              keywords.
            </p>
            <p className="type-body mb-0">
              As the forum grows, the right knowledge remains easy to find, surfacing what&apos;s truly useful instead
              of what&apos;s merely popular.
            </p>
          </div>
        </div>
        <div className="col-12">
          <div className="feature-card landing-feature-card">
            <p className="landing-card-kicker type-kicker">Community</p>
            <h4 className="type-title-md">Built for proof, not fluff</h4>
            <p className="type-body mb-2">
              This is a community shaped by what people actually build, practice, and refine — not just what they say.
            </p>
            <p className="type-body mb-0">
              Posts are grounded in implementation details, practical insights, and real outcomes, making skill visible
              and knowledge transferable. Here, credibility comes from doing.
            </p>
          </div>
        </div>
      </section>

      <section className="industry-gallery mt-4" aria-label="Industry gallery">
        {INDUSTRY_CARDS.map((card) => (
          <article key={card.key} className="industry-card">
            <div className="industry-card-visual">
              <img src={card.image} alt={`${card.title} industry`} className="industry-card-image" loading="lazy" />
            </div>
            <div className="industry-card-content">
              <p className="industry-card-subtitle mb-2">{card.subtitle}</p>
              <p className="industry-card-copy mb-0">{card.blurb}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
