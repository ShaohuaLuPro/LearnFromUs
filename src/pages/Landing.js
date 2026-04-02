import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const PRINCIPLE_SLIDES = [
  {
    key: 'forum',
    eyebrow: 'Forum',
    title: 'Curated by topics',
    summary: 'Explore ideas, systems, and real-world practices without the usual noise.',
    body: [
      'Every forum is organized with intention so people can move straight into the signal.',
      'Sections are built to surface grounded experience, not endless chatter.'
    ],
    accent: 'Structure',
    meta: ['Topic-first navigation', 'Clear sections', 'Signal over noise']
  },
  {
    key: 'search',
    eyebrow: 'Search',
    title: 'Find posts by real relevance',
    summary: 'Useful knowledge should stay discoverable as the forum grows.',
    body: [
      'Search looks across titles, content, tags, authors, and topics with meaning in mind.',
      'The goal is simple: bring forward what helps, not just what happens to be loud.'
    ],
    accent: 'Precision',
    meta: ['Meaning-ranked results', 'Cross-topic discovery', 'Built to scale']
  },
  {
    key: 'community',
    eyebrow: 'Community',
    title: 'Built for proof, not fluff',
    summary: 'Credibility comes from what people build, test, and refine in public.',
    body: [
      'Posts are shaped by implementation details, practical insight, and real outcomes.',
      'That makes skill easier to see and knowledge easier to carry into real work.'
    ],
    accent: 'Proof',
    meta: ['Real execution', 'Transferable knowledge', 'Visible skill']
  }
];

export default function Landing({ currentUser, forums = [], loadingForums = false }) {
  const forumCount = forums.length;
  const [activePrinciple, setActivePrinciple] = useState(0);
  const cinematicRef = useRef(null);
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
  const activeSlide = PRINCIPLE_SLIDES[activePrinciple];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivePrinciple((current) => (current + 1) % PRINCIPLE_SLIDES.length);
    }, 6200);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const root = cinematicRef.current;
    if (!root) {
      return undefined;
    }

    const { body, documentElement } = document;
    const media = window.matchMedia('(min-width: 1101px) and (prefers-reduced-motion: no-preference)');
    const panels = Array.from(root.querySelectorAll('.landing-cinematic-panel'));
    const ratios = new Map();
    let observer;

    const setFocusedPanel = () => {
      const bestPanel = panels.reduce((best, panel) => {
        const panelRatio = ratios.get(panel) || 0;
        const bestRatio = ratios.get(best) || 0;
        return panelRatio > bestRatio ? panel : best;
      }, panels[0]);

      panels.forEach((panel) => {
        panel.classList.toggle('is-focused', panel === bestPanel);
      });
    };

    const setup = () => {
      body.classList.add('landing-cinematic-page');
      documentElement.classList.add('landing-cinematic-page');

      panels.forEach((panel, index) => {
        ratios.set(panel, index === 0 ? 1 : 0);
        panel.classList.toggle('is-focused', index === 0);
      });

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            ratios.set(entry.target, entry.intersectionRatio);
          });
          setFocusedPanel();
        },
        {
          threshold: [0.2, 0.4, 0.6, 0.75, 0.9]
        }
      );

      panels.forEach((panel) => observer.observe(panel));
    };

    const teardown = () => {
      body.classList.remove('landing-cinematic-page');
      documentElement.classList.remove('landing-cinematic-page');
      panels.forEach((panel) => panel.classList.remove('is-focused'));
      ratios.clear();
      if (observer) {
        observer.disconnect();
        observer = undefined;
      }
    };

    const handleChange = (event) => {
      teardown();
      if (event.matches) {
        setup();
      }
    };

    if (media.matches) {
      setup();
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange);
    } else {
      media.addListener(handleChange);
    }

    return () => {
      teardown();
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  return (
    <div className="container page-shell landing-cinematic-flow" ref={cinematicRef}>
      <section className="landing-hero landing-cinematic-panel">
        <div className="landing-copy landing-panel-stage">
          <p className="landing-eyebrow type-kicker">A Forum For Doers</p>

          <div className="landing-hero-grid">
            <div className="landing-hero-stage">
              <h1 className="landing-title landing-title-editorial type-title-lg">
                <span className="landing-title-row">Most platforms are</span>
                <span className="landing-title-row">full of opinions.</span>
                <span className="landing-title-row landing-title-row-soft">Very few show</span>
                <span className="landing-title-row landing-title-row-strong">real execution.</span>
              </h1>
            </div>

            <div className="landing-hero-side">
              <p className="landing-text type-body">
                Real experience beats opinions. Execution is visible. Useful knowledge compounds across software,
                fitness, and everyday life.
              </p>
              <p className="landing-hero-side-note">
                Built for people who care more about systems, craft, and proof than volume.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-story-band landing-story-band-signal landing-cinematic-panel" aria-label="Platform highlights">
        <div className="landing-story-band-shell landing-panel-stage">
          <div className="landing-story-band-head">
            <p className="landing-story-band-kicker">Signal</p>
            <h2 className="landing-story-band-title">Built to surface what actually matters.</h2>
          </div>
          <div className="landing-story-band-body">
            <p className="landing-story-band-copy">
              Real execution. Useful knowledge. Signal over noise. The product is shaped to reward clarity, not volume.
            </p>
            <div className="landing-hero-badges" aria-label="Core principles">
              <span className="landing-hero-badge">Real execution</span>
              <span className="landing-hero-badge">Useful knowledge</span>
              <span className="landing-hero-badge">Signal over noise</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-story-band landing-story-band-platform landing-cinematic-panel" aria-label="Forum stats">
        <div className="landing-story-band-shell landing-panel-stage">
          <div className="landing-story-band-head">
            <p className="landing-story-band-kicker">Platform</p>
            <h2 className="landing-story-band-title">Growing in scope, staying intentional.</h2>
          </div>
          <div className="landing-story-band-body">
            <p className="landing-story-band-copy">
              A growing set of forums and sections organized around useful knowledge and real execution.
            </p>
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
          </div>
        </div>
      </section>

      <section className="landing-story-band landing-story-band-entry landing-cinematic-panel" aria-label="Primary navigation">
        <div className="landing-story-band-shell landing-panel-stage">
          <div className="landing-story-band-head">
            <p className="landing-story-band-kicker">Start Here</p>
            <h2 className="landing-story-band-title">Enter through the work, or through the story.</h2>
          </div>
          <div className="landing-story-band-body">
            <p className="landing-story-band-copy">
              Move straight into the forum or learn the thinking behind the platform first.
            </p>
          <div className="landing-actions">
            <Link to="/forum" className="landing-hero-link text-decoration-none">
              <span className="landing-hero-link-label">Forum</span>
              <span className="landing-hero-link-title">Go to Forum Feed</span>
              <span className="landing-hero-link-copy">Browse live discussions and topic spaces.</span>
            </Link>
            <Link to="/about" className="landing-hero-link text-decoration-none">
              <span className="landing-hero-link-label">About</span>
              <span className="landing-hero-link-title">Read Our Story</span>
              <span className="landing-hero-link-copy">See why LearnFromUs exists and where it is headed.</span>
            </Link>
          </div>
            {!currentUser && (
              <Link to="/login" className="landing-text-link landing-hero-tertiary-link text-decoration-none">
                Join and start posting
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="landing-principles-showcase landing-cinematic-panel" aria-label="Forum principles">
        <div className={`landing-principle-card principle-${activeSlide.key} landing-panel-stage`}>
          <div className="landing-principle-backdrop" aria-hidden="true">
            <span className="landing-principle-orb landing-principle-orb-one" />
            <span className="landing-principle-orb landing-principle-orb-two" />
            <span className="landing-principle-grid" />
          </div>

          <div className="landing-principle-main">
            <div className="landing-principle-header">
              <p className="landing-principle-kicker">{activeSlide.eyebrow}</p>
            </div>

            <div className="landing-principle-copy">
              <p className="landing-principle-accent">{activeSlide.accent}</p>
              <h3 className="landing-principle-title">{activeSlide.title}</h3>
              <p className="landing-principle-summary">{activeSlide.summary}</p>
            </div>
          </div>

          <div className="landing-principle-side">
            <div className="landing-principle-body">
              {activeSlide.body.map((paragraph) => (
                <p key={paragraph} className="landing-principle-text">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="landing-principle-meta">
              {activeSlide.meta.map((item) => (
                <span key={item} className="landing-principle-chip">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="landing-principle-dots" role="tablist" aria-label="Forum principles slides">
          {PRINCIPLE_SLIDES.map((slide, index) => (
            <button
              key={slide.key}
              type="button"
              className={`landing-principle-dot ${index === activePrinciple ? 'is-active' : ''}`}
              onClick={() => setActivePrinciple(index)}
              aria-label={`Show ${slide.eyebrow}`}
              aria-selected={index === activePrinciple}
              role="tab"
            />
          ))}
        </div>
      </section>

      <section className="row g-4 mt-1 landing-feature-stack is-legacy">
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
