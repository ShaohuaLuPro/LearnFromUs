import React, { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const SECTION_CONTENT = {
  story: {
    heroTitle: 'Story',
    heroCopy:
      'LearnFromUs exists to make technical learning practical, transparent, and useful for builders.',
    blocks: [
      {
        kicker: 'Why This Exists',
        title: 'LearnFromUs makes technical learning more public and more useful.',
        copy:
          'Stop passive learning. In software and data, most tutorials are bookmarked and forgotten. LearnFromUs is the opposite. We pull back the curtain on real implementation- shipping, debugging, and architecture - providing the practical hacks that actual builders need to execute.'
      },
      {
        kicker: 'Long-Term Direction',
        title: 'To build a platform where proof of skill is woven into the product.',
        copy:
          'Over time, LearnFromUs should become a place where strong work naturally stands out: clear posts, strong examples, useful feedback, and visible patterns of execution. The point is not to mimic a traditional social feed. The point is to build a technical community where what you can explain, ship, and improve is visible by default.'
      }
    ]
  },
  leadership: {
    heroTitle: 'Leadership',
    heroCopy: '',
    members: [
      {
        key: 'founder',
        name: 'Shaohua Lu',
        role: 'Founder',
        image: `${process.env.PUBLIC_URL}/images/founder-portrait.jpg`,
        imageAlt: 'Shaohua Lu'
      },
      {
        key: 'teamMembers',
        name: 'Ben He',
        role: 'Software Developer',
        image: `${process.env.PUBLIC_URL}/images/33.jpg`,
        imageAlt: 'Ben He'
      }
    ]
  },
  founder: {
    heroTitle: 'Founder',
    heroCopy:
      'I am Shaohua Lu, founder of LearnFromUs. I build practical products at the intersection of software engineering, AI, and community learning.',
    profile: {
      eyebrow: '',
      name: 'Shaohua Lu',
      role: 'Founder',
      summary:
        'Building a technical community where people learn by shipping, explaining, and sharing what actually works.',
      location: 'Boston, MA',
      email: 'tomlu1234567@gmail.com',
      image: `${process.env.PUBLIC_URL}/images/founder-portrait.jpg`,
      imageAlt: 'Shaohua Lu',
      links: [
        {
          label: 'LinkedIn',
          href: 'https://www.linkedin.com/in/shaohualu/'
        },
        {
          label: 'GitHub',
          href: 'https://github.com/ShaohuaLuPro'
        }
      ]
    },
    blocks: [
      {
        kicker: 'What I Bring',
        title: 'My background spans product execution, software delivery, and data science.',
        copy:
          'I work across full-stack product development and applied AI, with experience in software engineering, analytics, machine learning, and team execution. That mix shapes how this platform is built: practical on the product side, structured on the engineering side, and rigorous about signal over noise.'
      }
    ]
  },
  teamMembers: {
    heroTitle: 'Team Members',
    heroCopy:
      'Meet Ben He, a software developer contributing to LearnFromUs with cross-functional experience and collaborative execution.',
    profile: {
      eyebrow: '',
      name: 'Ben He',
      role: 'Software Developer',
      summary:
        'Experienced across different domains, building cross-disciplinary coordination and collaboration to move products forward.',
      location: 'Boston, MA',
      email: 'bigbenokk@gmail.com',
      image: `${process.env.PUBLIC_URL}/images/33.jpg`,
      imageAlt: 'Ben He',
      links: [
        {
          label: 'GitHub',
          href: 'https://github.com/bigbenokk'
        }
      ]
    },
    blocks: []
  }
};

const SECTION_ROUTES = {
  story: '/about',
  leadership: '/about/leadership',
  founder: '/about/leadership/founder',
  teamMembers: '/about/leadership/team-members'
};

export default function About() {
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedPath = useMemo(() => {
    const pathname = location.pathname.replace(/\/+$/, '');
    return pathname || '/';
  }, [location.pathname]);

  useEffect(() => {
    const legacySection = new URLSearchParams(location.search).get('section');
    if (!legacySection) {
      return;
    }

    const redirectTarget = SECTION_ROUTES[legacySection] || SECTION_ROUTES.story;
    navigate(redirectTarget, { replace: true });
  }, [location.search, navigate]);

  const activeSection = useMemo(() => {
    if (normalizedPath === SECTION_ROUTES.leadership) {
      return 'leadership';
    }
    if (normalizedPath === SECTION_ROUTES.founder) {
      return 'founder';
    }
    if (normalizedPath === SECTION_ROUTES.teamMembers) {
      return 'teamMembers';
    }
    return 'story';
  }, [normalizedPath]);
  const section = useMemo(() => SECTION_CONTENT[activeSection], [activeSection]);
  const setActiveSection = (nextSection) => {
    navigate(SECTION_ROUTES[nextSection] || SECTION_ROUTES.story);
  };
  const profile = section.profile;
  const highlightedLabels = new Set([
    'Why This Exists',
    'Long-Term Direction',
    'Profile',
    'What I Bring'
  ]);
  const largeKickers = new Set([
    'Why This Exists',
    'Long-Term Direction',
    'Profile',
    'What I Bring',
    'Location',
    'Email'
  ]);
  return (
    <div className="container page-shell about-page-shell" data-page="about">
      <div className="row g-4">
        {activeSection === 'story' ? (
          <div className="col-lg-12">
            <section className="panel about-story-panel h-100">
              <section className="about-story-hero" aria-label="Story hero">
                <p className="about-story-hero-eyebrow">A Forum For Doers</p>
                <h2 className="about-story-hero-title mb-0">
                  <span className="about-story-hero-title-main">Most platforms are full of opinions.</span>
                  <span className="about-story-hero-title-em">
                    Very few show <span className="about-word-bounce about-word-bounce-delay-0">real</span>{' '}
                    <span className="about-word-bounce about-word-bounce-delay-1">execution</span>.
                  </span>
                </h2>
              </section>

              {section.blocks.map((block, idx) => (
                <div
                  key={block.kicker}
                  className={`about-story-block ${idx === section.blocks.length - 1 ? 'is-last' : ''} ${
                    block.kicker === 'Why This Exists' ? 'no-divider' : ''
                  }`}
                >
                  <p
                    className={`about-story-kicker ${
                      highlightedLabels.has(block.kicker)
                        ? 'about-story-kicker-highlight'
                        : ''
                    } ${
                      largeKickers.has(block.kicker)
                        ? 'about-story-kicker-xl'
                        : ''
                    }`}
                  >
                    {block.kicker}
                  </p>
                  {['Why This Exists', 'Long-Term Direction'].includes(block.kicker) ? null : (
                    <h3
                      className={`about-story-title ${
                        block.kicker === 'Long-Term Direction' ? 'about-story-title-why' : ''
                      }`}
                    >
                      {block.title}
                    </h3>
                  )}
                  <p
                    className={`about-story-copy mb-0 ${
                      ['Why This Exists', 'Long-Term Direction'].includes(block.kicker)
                        ? 'about-story-copy-highlight'
                        : ''
                    }`}
                  >
                    {block.kicker === 'Why This Exists' ? (
                      <>
                        <span className="about-longterm-stair-line about-longterm-stair-line-1">
                          LearnFromUs began as a platform for deep, meaningful discussions - built for people who
                          expect more than surface-level content. It was designed as a space where ideas are explored
                          with clarity, and knowledge is built through thoughtful exchange rather than quick takes.
                        </span>
                        <span className="about-longterm-stair-line about-longterm-stair-line-2">
                          From the beginning, Shaohua&apos;s vision centered on ownership. Not just participation, but
                          true control - giving users the ability to create, lead, and shape their own communities. The
                          goal was to move beyond passive consumption and toward active contribution, where individuals
                          don&apos;t just follow conversations, but define them.
                        </span>
                        <span className="about-longterm-stair-line about-longterm-stair-line-3">
                          As the platform evolved, Ben joined and helped expand that vision. Living in Boston - a city
                          defined by its academic depth and culture of learning - brought a new perspective. It
                          reinforced the belief that meaningful knowledge is not accidental. It is built, tested, and
                          refined over time, through real experience and shared insight.
                        </span>
                        <span className="about-longterm-stair-line about-longterm-stair-line-3">
                          The mission grew from building a discussion platform into something more deliberate: a place
                          where knowledge compounds, where signal rises above noise, and where people are encouraged to
                          contribute what they&apos;ve actually learned through doing.
                        </span>
                        <span className="about-longterm-stair-line about-longterm-stair-line-3">
                          Today, we focus on one thing:
                        </span>
                        <span className="about-longterm-stair-line about-longterm-stair-line-3">
                          Building a space where real experience is shared, trusted, and continuously refined.
                        </span>
                      </>
                    ) : block.kicker === 'Long-Term Direction' ? (
                      <>
                        <div className="about-longterm-cards">
                          <article className="about-longterm-card">
                            <span className="about-longterm-icon" aria-hidden="true">
                              <svg viewBox="0 0 24 24" className="about-longterm-icon-svg">
                                <path d="M13.5 2 5 13h6l-1 9 9-12h-6l.5-8z" />
                              </svg>
                            </span>
                            <h4 className="about-longterm-card-title">Real experience beats opinions</h4>
                          </article>
                          <article className="about-longterm-card">
                            <span className="about-longterm-icon" aria-hidden="true">
                              <svg viewBox="0 0 24 24" className="about-longterm-icon-svg">
                                <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
                                <path d="m8 12 2.6 2.6L16 9.2" />
                              </svg>
                            </span>
                            <h4 className="about-longterm-card-title">Execution is visible</h4>
                          </article>
                          <article className="about-longterm-card">
                            <span className="about-longterm-icon" aria-hidden="true">
                              <svg viewBox="0 0 24 24" className="about-longterm-icon-svg">
                                <path d="m12 3 8.5 4.9L12 12.8 3.5 7.9 12 3z" />
                                <path d="m3.5 12.5 8.5 4.9 8.5-4.9" />
                              </svg>
                            </span>
                            <p className="about-longterm-card-copy mb-0">
                              Useful knowledge compounds - across software, fitness, and everyday life.
                            </p>
                          </article>
                        </div>
                        <Link
                          to={SECTION_ROUTES.leadership}
                          className="founder-link-pill is-bright d-inline-flex mt-4 text-decoration-none"
                        >
                          Meet Our Leadership
                        </Link>
                      </>
                    ) : (
                      block.copy
                    )}
                  </p>
                </div>
              ))}
            </section>
          </div>
        ) : activeSection === 'leadership' ? (
          <div className="col-lg-12">
            <section className="panel leadership-panel h-100">
              <header className="leadership-hero">
                <Link
                  to={SECTION_ROUTES.story}
                  className="about-back-link text-decoration-none"
                  aria-label="Back to About"
                >
                  <span className="about-back-link-icon" aria-hidden="true">←</span>
                  <span className="about-back-link-text">Back</span>
                </Link>
                <h2 className="leadership-hero-title mb-0">{section.heroTitle}</h2>
                {section.heroCopy ? <p className="leadership-hero-copy mb-0">{section.heroCopy}</p> : null}
              </header>

              <div className="leadership-grid">
                {section.members.map((member) => (
                  <article key={member.key} className="leadership-card">
                    <div className="leadership-card-main">
                      <div className="leadership-card-copy">
                        <h3 className="leadership-card-name mb-2">{member.name}</h3>
                        <p className="leadership-card-role mb-0">{member.role}</p>
                      </div>
                      <div className="leadership-card-image-shell">
                        <img
                          src={member.image}
                          alt={member.imageAlt}
                          className={`leadership-card-image leadership-card-image-${member.key}`}
                        />
                      </div>
                    </div>

                    <div className="leadership-card-actions">
                      <button
                        type="button"
                        className="leadership-action-btn"
                        onClick={() => setActiveSection(member.key)}
                      >
                        READ MORE
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <>
            <div className="col-lg-8 about-detail-col">
              <section className="panel about-story-panel about-detail-panel h-100">
                <div className="about-story-block">
                  {profile.eyebrow ? (
                    <p
                      className={`about-story-kicker ${
                        highlightedLabels.has(profile.eyebrow) ? 'about-story-kicker-highlight' : ''
                      } ${
                        largeKickers.has(profile.eyebrow) ? 'about-story-kicker-xl' : ''
                      }`}
                    >
                      {profile.eyebrow}
                    </p>
                  ) : null}
                  <h3 className="about-story-title about-profile-name mb-2">
                    {profile.name}
                    {profile.role ? <span className="about-profile-role-inline">{profile.role}</span> : null}
                  </h3>
                  <p
                    className={`about-story-copy mb-0 ${
                      activeSection === 'founder' ? 'about-story-copy-highlight' : ''
                    } ${activeSection === 'founder' ? 'about-story-copy-story-match' : ''} ${
                      activeSection === 'teamMembers' ? 'about-story-copy-plain' : ''
                    }`}
                  >
                    {profile.summary}
                  </p>
                </div>

                {section.blocks.length > 0 ? (
                  section.blocks.map((block, idx) => (
                    <div
                      key={block.kicker}
                      className="about-story-block"
                    >
                      <p
                        className={`about-story-kicker ${
                          highlightedLabels.has(block.kicker) ? 'about-story-kicker-highlight' : ''
                        } ${
                          largeKickers.has(block.kicker) ? 'about-story-kicker-xl' : ''
                        }`}
                      >
                        {block.kicker}
                      </p>
                      {activeSection === 'founder' && block.kicker === 'What I Bring' ? (
                        <p className="about-story-copy about-story-copy-story-match mb-0">
                          {`${block.title} ${block.copy}`}
                        </p>
                      ) : (
                        <>
                          <h3
                            className={`about-story-title ${
                              activeSection === 'founder' ? 'about-story-title-story-match' : ''
                            }`}
                          >
                            {block.title}
                          </h3>
                          <p
                            className={`about-story-copy mb-0 ${
                              activeSection === 'founder' ? 'about-story-copy-story-match' : ''
                            }`}
                          >
                            {block.copy}
                          </p>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="about-story-block">
                    <p className="about-story-kicker about-story-kicker-highlight">What I Bring</p>
                    <p className="about-story-copy about-story-copy-story-match about-team-summary-centered mb-0">
                      Shaped by years of working across industries and borders, I've learned that the most
                      meaningful progress happens at the intersection of people, process, and technology. I
                      bring that perspective into every team I join - bridging communication gaps, driving
                      engineering execution, and translating complexity into clarity. At LearnFromUs, I channel
                      this into building products that are not just functional, but thoughtfully crafted and
                      built to last.
                    </p>
                  </div>
                )}

                <div className="about-story-block is-last">
                  <div className="about-connect-list">
                    <div className="about-connect-row">
                      <span className="about-connect-label about-story-kicker-highlight about-story-kicker-xl">Location</span>
                      <span className="about-connect-value">{profile.location}</span>
                    </div>
                  </div>

                  <div className="founder-link-row mt-3">
                    <a
                      href={`mailto:${profile.email}`}
                      className="founder-link-pill"
                    >
                      Email
                    </a>
                    {profile.links.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="founder-link-pill"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>

                </div>
              </section>
              <div className="founder-link-row mt-3">
                <Link
                  to={SECTION_ROUTES.leadership}
                  className="about-back-link text-decoration-none"
                  aria-label="Back to Leadership"
                >
                  <span className="about-back-link-icon" aria-hidden="true">←</span>
                  <span className="about-back-link-text">Back</span>
                </Link>
              </div>
            </div>

            <div className="col-lg-4">
              <section className="about-portrait-panel h-100">
                <img
                  src={profile.image}
                  alt={profile.imageAlt}
                  className="about-portrait-image"
                />
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
