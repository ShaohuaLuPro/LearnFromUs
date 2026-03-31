import React, { useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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
  whyWeExist: '/about/why-we-exist',
  leadership: '/about/leadership',
  founder: '/about/leadership/founder',
  teamMembers: '/about/leadership/team-members'
};
const DIRECTION_CARDS = [
  {
    key: 'experience',
    icon: 'lightning',
    title: 'EXPERIENCE BEATS OPINIONS.',
    copy: 'Real delivery notes beat vague takes. Constraints, tradeoffs, and outcomes create reusable learning.',
    tags: []
  },
  {
    key: 'execution',
    icon: 'check',
    title: 'VISIBLE EXECUTION.',
    copy: 'Milestones, commits, and clear updates make progress visible and collaboration measurable.',
    tags: []
  },
  {
    key: 'compounding',
    icon: 'folder',
    title: 'KNOWLEDGE COMPOUNDING.',
    copy: 'Useful patterns stack across domains and become faster to apply with context.',
    tags: ['Software', 'Fitness', 'Everyday Life']
  }
];

const BENTO_SCROLL_CARDS = [
  {
    key: 'cardA',
    image: `${process.env.PUBLIC_URL}/images/bento/1.jpg`,
    alt: 'Monitor workspace',
    x: '-45vw',
    y: '-26vh',
    rotate: -10,
    scale: 1.2,
    depth: 1.3
  },
  {
    key: 'cardB',
    image: `${process.env.PUBLIC_URL}/images/bento/2.jpg`,
    alt: 'Coffee shop conversation',
    x: '40vw',
    y: '-18vh',
    rotate: 10,
    scale: 1.15,
    depth: 1.15
  },
  {
    key: 'cardC',
    image: `${process.env.PUBLIC_URL}/images/bento/3.jpg`,
    alt: 'Family cooking scene',
    x: '-38vw',
    y: '28vh',
    rotate: -8,
    scale: 1.1,
    depth: 1.05
  },
  {
    key: 'cardD',
    image: `${process.env.PUBLIC_URL}/images/bento/4.jpg`,
    alt: 'Forum discussion UI',
    x: '42vw',
    y: '32vh',
    rotate: 8,
    scale: 1.2,
    depth: 1.25
  }
];

export default function About() {
  const location = useLocation();
  const navigate = useNavigate();
  const bentoScrollRef = useRef(null);
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
    if (normalizedPath === SECTION_ROUTES.whyWeExist) {
      return 'whyWeExist';
    }
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

  useEffect(() => {
    if (activeSection !== 'story' || !bentoScrollRef.current) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray('.about-bento-scroll-card');
      const loops = cards.map((card) => {
        const depth = Number(card.dataset.depth || 1);
        const init = {
          xPercent: -50,
          yPercent: -50,
          x: card.dataset.x || 0,
          y: card.dataset.y || 0,
          rotate: Number(card.dataset.rotate || 0),
          scale: Number(card.dataset.scale || 1),
          opacity: 0.96,
          filter: 'blur(0px) brightness(1)',
          zIndex: Math.round(depth * 10),
          force3D: true
        };
        const centerScale = 0.78 + Math.max(0, 1.1 - depth) * 0.12;
        const duration = Math.max(0.5, 1.1 + depth * 0.2 + 2.1);
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5, paused: true });
        tl.set(card, init);
        tl.to(card, {
          ...init,
          x: 0,
          y: 0,
          rotate: 0,
          scale: centerScale,
          opacity: 0,
          filter: 'blur(6px) brightness(0.82)',
          duration,
          ease: 'power2.inOut'
        });
        tl.set(card, init);
        return tl;
      });

      ScrollTrigger.create({
        trigger: '.about-bento-scroll-section',
        start: 'top center',
        end: 'bottom center',
        once: false,
        onEnter: () => loops.forEach((tl) => tl.restart().play()),
        onLeave: () => loops.forEach((tl) => tl.pause(0)),
        onEnterBack: () => loops.forEach((tl) => tl.restart().play()),
        onLeaveBack: () => loops.forEach((tl) => tl.pause(0))
      });
    }, bentoScrollRef);

    return () => ctx.revert();
  }, [activeSection]);
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
              <section className="about-story-hero about-story-hero-v2" aria-label="Story hero">
                <p className="about-story-hero-eyebrow">A Forum For Doers</p>
                <h2 className="about-story-hero-title mb-0">
                  <span className="about-story-hero-title-main">OPINIONS ARE CHEAP.</span>
                  <span className="about-story-hero-title-em">
                    REAL EXECUTION IS RARE.
                    <br />
                    JOIN THE EXECUTORS.
                  </span>
                </h2>
              </section>

              <section className="about-bento-scroll-section" ref={bentoScrollRef} aria-label="Bento scroll hero">
                <div className="about-bento-scroll-pin">
                  <div className="about-bento-scroll-stage">
                    <div className="about-bento-scroll-copy">
                      <h3 className="about-bento-scroll-title mb-2">Why We Exist</h3>
                      <p className="about-bento-scroll-subtitle mb-2">
                        Our Origin & Purpose: Built to turn shared knowledge into visible execution. View the full
                        story of how LearnFromUs evolved from Shaohua&apos;s original vision into the collaborative,
                        execution-focused space it is today.
                      </p>
                      <Link to="/origin-purpose" className="about-bento-scroll-link text-decoration-none">
                        Enter
                      </Link>
                    </div>

                    {BENTO_SCROLL_CARDS.map((card) => (
                      <article
                        key={card.key}
                        className={`about-bento-scroll-card about-bento-scroll-card-${card.key}`}
                        data-x={card.x}
                        data-y={card.y}
                        data-rotate={card.rotate}
                        data-scale={card.scale}
                        data-depth={card.depth}
                      >
                        <img src={card.image} alt={card.alt} className="about-bento-scroll-image" />
                      </article>
                    ))}
                  </div>
                </div>
              </section>

              <section className="about-leadership-cta">
                <div className="about-leadership-cta-glass">
                  <p className="about-story-copy mb-0">
                    Meet the people shaping LearnFromUs with long-term product and engineering ownership.
                  </p>
                  <Link
                    to={SECTION_ROUTES.leadership}
                    className="founder-link-pill is-bright d-inline-flex text-decoration-none"
                  >
                    Meet Our Leadership
                  </Link>
                </div>
              </section>

              <section className="about-direction-section">
                <header className="about-section-head">
                  <p className="about-story-kicker about-story-kicker-highlight mb-2">Long-Term Direction</p>
                </header>

                <div className="about-longterm-cards">
                  {DIRECTION_CARDS.map((card) => (
                    <article key={card.key} className={`about-longterm-card about-longterm-card-${card.key}`}>
                      <span className="about-longterm-icon-shell" aria-hidden="true">
                        {card.icon === 'lightning' ? (
                          <svg viewBox="0 0 24 24" className="about-longterm-icon-svg">
                            <path d="M13.5 2 5 13h6l-1 9 9-12h-6l.5-8z" />
                          </svg>
                        ) : null}
                        {card.icon === 'check' ? (
                          <svg viewBox="0 0 24 24" className="about-longterm-icon-svg">
                            <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
                            <path d="m8 12 2.6 2.6L16 9.2" />
                          </svg>
                        ) : null}
                        {card.icon === 'folder' ? (
                          <svg viewBox="0 0 24 24" className="about-longterm-icon-svg">
                            <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l1.7 2h6.8A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
                          </svg>
                        ) : null}
                      </span>
                      <h4 className="about-longterm-card-title">{card.title}</h4>
                      <p className="about-longterm-card-copy mb-0">{card.copy}</p>
                      {card.tags.length ? (
                        <div className="about-longterm-tags">
                          {card.tags.map((tag) => (
                            <span key={tag} className="about-longterm-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            </section>
          </div>
        ) : activeSection === 'whyWeExist' ? (
          <div className="col-lg-12">
            <section className="panel about-story-panel h-100">
              <header className="leadership-hero">
                <Link
                  to={SECTION_ROUTES.story}
                  className="about-back-link text-decoration-none"
                  aria-label="Back to About"
                >
                  <span className="about-back-link-icon" aria-hidden="true">←</span>
                  <span className="about-back-link-text">Back</span>
                </Link>
                <h2 className="leadership-hero-title mb-0">Why We Exist</h2>
              </header>

              <div className="about-why-exit-panel">
                <p className="about-story-copy mb-0">hello everyone，lalala</p>
              </div>
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
