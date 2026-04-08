import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';

const SECTION_CONTENT = {
  story: {
    heroTitle: 'Story',
    heroCopy:
      'tsumit exists to make technical learning practical, transparent, and useful for builders.',
    blocks: [
      {
        kicker: 'Why This Exists',
        title: 'tsumit makes technical learning more public and more useful.',
        copy:
          'Stop passive learning. In software and data, most tutorials are bookmarked and forgotten. tsumit is the opposite. We pull back the curtain on real implementation- shipping, debugging, and architecture - providing the practical hacks that actual builders need to execute.'
      },
      {
        kicker: 'Long-Term Direction',
        title: 'To build a platform where proof of skill is woven into the product.',
        copy:
          'Over time, tsumit should become a place where strong work naturally stands out: clear posts, strong examples, useful feedback, and visible patterns of execution. The point is not to mimic a traditional social feed. The point is to build a technical community where what you can explain, ship, and improve is visible by default.'
      }
    ]
  },
  leadership: {
    heroTitle: 'Executive Profiles',
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
      },
      {
        key: 'sallyHuang',
        name: 'Sally Huang',
        role: 'Digital Designer',
        image: `${process.env.PUBLIC_URL}/images/111.png`,
        imageAlt: 'Sally Huang'
      }
    ]
  },
  founder: {
    heroTitle: 'Founder',
    heroCopy:
      'I am Shaohua Lu, founder of tsumit. I build practical products at the intersection of software engineering, AI, and community learning.',
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
      'Meet Ben He, a software developer contributing to tsumit with cross-functional experience and collaborative execution.',
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
          label: 'LinkedIn',
          href: 'https://linkedin.com/in/ben-he-9071893b9'
        },
        {
          label: 'GitHub',
          href: 'https://github.com/bigbenokk'
        }
      ]
    },
    blocks: []
  },
  sallyHuang: {
    heroTitle: 'Team Members',
    heroCopy:
      'Meet Sally Huang, a digital designer shaping visual direction and product experience at tsumit.',
    profile: {
      eyebrow: '',
      name: 'Sally Huang',
      role: 'Digital Designer',
      summary:
        'Shaping how the world sees, feels,\nand interacts with ideas through\nthe craft of visual design.',
      location: 'Boston, MA',
      email: 'sally.huang1999@gmail.com',
      image: `${process.env.PUBLIC_URL}/images/111.png`,
      imageAlt: 'Sally Huang',
      links: [
        {
          label: 'LinkedIn',
          href: 'https://linkedin.com/in/jing-sally-huang'
        }
      ]
    },
    blocks: [
      {
        kicker: 'What I Bring',
        title: '',
        copy:
          "Professional in Digital Media with a focus on User Experience Design and Research. Holding a Bachelor of Science in Fashion Design with a Fine Arts minor, this uncommon blend of disciplines has shaped a distinctly creative lens — one that bridges artistic intuition with technical rigor to explore the full spectrum of possibilities in digital media.\n\nFluent in web technologies including HTML, CSS, and JavaScript, and deeply versed in Adobe's creative suite, I bring both the craft and the code. My experience as a Digital Product Creator at L.L. Bean honed a sharp instinct for problem-solving, a commitment to creativity, and the discipline of delivering under pressure."
      }
    ]
  }
};

const SECTION_ROUTES = {
  story: '/about',
  whyWeExist: '/about/why-we-exist',
  leadership: '/about/team',
  founder: '/about/founder',
  teamMembers: '/about/ben-he',
  sallyHuang: '/about/sally-huang'
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

const WHY_WE_EXIST_FEATURE = {
  eyebrow: "Why we're building this",
  body: [
    'Tsumit exists to make learning more public, more practical, and more accountable. We care about knowledge that can be tested, shared, and turned into action.',
    'The goal is not more noise. It is clearer signal: proof of work, visible execution, and ideas that become useful because people actually apply them.'
  ],
  ctaLabel: 'More',
  ctaTo: '/origin-purpose',
  image: `${process.env.PUBLIC_URL}/images/about-4.jpg`,
  imageAlt: 'People collaborating around a shared digital workspace'
};

const BENTO_SCROLL_CARDS = [
  {
    key: 'cardA',
    image: `${process.env.PUBLIC_URL}/images/about-1.jpg`,
    alt: 'Monitor workspace',
    x: '-45vw',
    y: '-26vh',
    rotate: -10,
    scale: 0.6,
    depth: 1.3
  },
  {
    key: 'cardB',
    image: `${process.env.PUBLIC_URL}/images/about-2.jpg`,
    alt: 'Coffee shop conversation',
    x: '40vw',
    y: '-18vh',
    rotate: 10,
    scale: 0.575,
    depth: 1.15
  },
  {
    key: 'cardC',
    image: `${process.env.PUBLIC_URL}/images/about-3.jpg`,
    alt: 'Family cooking scene',
    x: '-38vw',
    y: '28vh',
    rotate: -8,
    scale: 0.55,
    depth: 1.05
  },
  {
    key: 'cardD',
    image: `${process.env.PUBLIC_URL}/images/about-4.jpg`,
    alt: 'Space discussion UI',
    x: '42vw',
    y: '32vh',
    rotate: 8,
    scale: 0.6,
    depth: 1.25
  }
];

const HERO_PARTICLES_LEGACY = [
  { key: 'p1', left: '4%', top: '10%', size: 'xs', layer: 'back', duration: '5.8s', delay: '0.2s', driftX: '1px', driftY: '-1px', peak: '0.06' },
  { key: 'p2', left: '8%', top: '16%', size: 'sm', layer: 'back', duration: '4.9s', delay: '1.35s', driftX: '-1px', driftY: '1px', peak: '0.05' },
  { key: 'p3', left: '14%', top: '20%', size: 'md', layer: 'front', duration: '6.4s', delay: '0.55s', driftX: '2px', driftY: '-1px', peak: '0.09' },
  { key: 'p4', left: '18%', top: '28%', size: 'xs', layer: 'back', duration: '5.3s', delay: '2.1s', driftX: '1px', driftY: '1px', peak: '0.04' },
  { key: 'p5', left: '6%', top: '34%', size: 'sm', layer: 'front', duration: '6.8s', delay: '0.9s', driftX: '-2px', driftY: '1px', peak: '0.08' },
  { key: 'p6', left: '20%', top: '40%', size: 'lg', layer: 'front', duration: '5.6s', delay: '1.8s', driftX: '2px', driftY: '-2px', peak: '0.1' },
  { key: 'p7', left: '10%', top: '48%', size: 'xs', layer: 'back', duration: '4.7s', delay: '0.75s', driftX: '-1px', driftY: '1px', peak: '0.05' },
  { key: 'p8', left: '16%', top: '56%', size: 'sm', layer: 'back', duration: '6.1s', delay: '2.35s', driftX: '1px', driftY: '-1px', peak: '0.04' },
  { key: 'p9', left: '5%', top: '64%', size: 'md', layer: 'front', duration: '5.9s', delay: '1.15s', driftX: '-2px', driftY: '2px', peak: '0.09' },
  { key: 'p10', left: '18%', top: '72%', size: 'xs', layer: 'back', duration: '4.8s', delay: '2.6s', driftX: '1px', driftY: '-1px', peak: '0.04' },
  { key: 'p11', left: '9%', top: '80%', size: 'sm', layer: 'front', duration: '6.5s', delay: '0.65s', driftX: '-1px', driftY: '2px', peak: '0.07' },
  { key: 'p12', right: '4%', top: '11%', size: 'xs', layer: 'back', duration: '5.4s', delay: '0.35s', driftX: '1px', driftY: '-1px', peak: '0.05' },
  { key: 'p13', right: '8%', top: '17%', size: 'sm', layer: 'back', duration: '4.8s', delay: '1.55s', driftX: '-1px', driftY: '1px', peak: '0.04' },
  { key: 'p14', right: '14%', top: '22%', size: 'md', layer: 'front', duration: '6.2s', delay: '0.85s', driftX: '2px', driftY: '-2px', peak: '0.08' },
  { key: 'p15', right: '18%', top: '30%', size: 'xs', layer: 'back', duration: '5.1s', delay: '2.15s', driftX: '1px', driftY: '1px', peak: '0.05' },
  { key: 'p16', right: '6%', top: '36%', size: 'sm', layer: 'front', duration: '6.7s', delay: '1.1s', driftX: '-2px', driftY: '1px', peak: '0.08' },
  { key: 'p17', right: '20%', top: '42%', size: 'lg', layer: 'front', duration: '5.7s', delay: '2.4s', driftX: '2px', driftY: '-2px', peak: '0.1' },
  { key: 'p18', right: '10%', top: '50%', size: 'xs', layer: 'back', duration: '4.6s', delay: '0.95s', driftX: '-1px', driftY: '1px', peak: '0.04' },
  { key: 'p19', right: '16%', top: '58%', size: 'sm', layer: 'back', duration: '6s', delay: '2.7s', driftX: '1px', driftY: '-1px', peak: '0.05' },
  { key: 'p20', right: '5%', top: '66%', size: 'md', layer: 'front', duration: '5.8s', delay: '1.3s', driftX: '-2px', driftY: '2px', peak: '0.09' },
  { key: 'p21', right: '18%', top: '74%', size: 'xs', layer: 'back', duration: '4.9s', delay: '2.95s', driftX: '1px', driftY: '-1px', peak: '0.04' },
  { key: 'p22', right: '9%', top: '81%', size: 'sm', layer: 'front', duration: '6.3s', delay: '0.7s', driftX: '-1px', driftY: '2px', peak: '0.07' }
];

void HERO_PARTICLES_LEGACY;

const HERO_DOT_ROWS = ['9%', '14%', '19%', '24%', '30%', '36%', '42%', '50%', '58%', '66%', '73%', '80%', '86%'];
const HERO_DOT_COLUMNS = {
  left: ['3%', '6.5%', '10%', '13.5%', '17%', '20.5%', '24%', '27.5%'],
  right: ['3%', '6.5%', '10%', '13.5%', '17%', '20.5%', '24%', '27.5%']
};
const HERO_DOT_SIZES = ['xs', 'sm', 'xs', 'md', 'sm', 'xs', 'lg', 'sm', 'xs', 'md'];
const HERO_DOT_DURATIONS = ['5.8s', '6.6s', '5.2s', '7.1s', '6.1s', '5.5s'];

const HERO_PARTICLES = ['left', 'right'].flatMap((side) =>
  HERO_DOT_COLUMNS[side].flatMap((offset, columnIndex) =>
    HERO_DOT_ROWS.map((top, rowIndex) => {
      const patternIndex = rowIndex + columnIndex * 2;
      const wave = side === 'left' ? columnIndex : columnIndex + 2;
      return {
        key: `${side}-${columnIndex}-${rowIndex}`,
        top,
        size: HERO_DOT_SIZES[patternIndex % HERO_DOT_SIZES.length],
        layer: (rowIndex + columnIndex) % 4 < 2 ? 'front' : 'back',
        duration: HERO_DOT_DURATIONS[columnIndex % HERO_DOT_DURATIONS.length],
        delay: `${(wave * 0.34 + (rowIndex % 5) * 0.07 + (side === 'right' ? 0.12 : 0)).toFixed(2)}s`,
        wave,
        row: rowIndex % 5,
        left: side === 'left' ? offset : undefined,
        right: side === 'right' ? offset : undefined
      };
    })
  )
);

export default function About() {
  const location = useLocation();
  const navigate = useNavigate();
  const bentoScrollRef = useRef(null);
  const leadershipHeaderRef = useRef(null);
  const leadershipGridRef = useRef(null);
  const [animatedTeamSummary, setAnimatedTeamSummary] = useState('');
  const [animatedSallySummary, setAnimatedSallySummary] = useState('');
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
    if (normalizedPath === SECTION_ROUTES.sallyHuang) {
      return 'sallyHuang';
    }
    return 'story';
  }, [normalizedPath]);

  useEffect(() => {
    if (activeSection !== 'story' || !bentoScrollRef.current) {
      return;
    }

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray('.about-bento-scroll-card');
      const isMobile = window.matchMedia('(max-width: 767.98px)').matches;
      const isTablet = window.matchMedia('(max-width: 1199.98px)').matches;
      const motionScale = isMobile ? 0.34 : isTablet ? 0.62 : 1;
      const paths = [
        { x: 220 * motionScale, y: 96 * motionScale },
        { x: 210 * motionScale, y: -88 * motionScale },
        { x: -220 * motionScale, y: 96 * motionScale },
        { x: -210 * motionScale, y: -88 * motionScale }
      ];
      const staggerPattern = [0.42, 0.08, 0.57, 0.23];

      cards.forEach((card, index) => {
        const path = paths[index] || paths[0];
        const loopDelay = staggerPattern[index % staggerPattern.length];

        // Keep the tuning in one place so we can easily adjust travel distance,
        // fade strength, and loop duration without rewriting the section.
        gsap.fromTo(
          card,
          {
            x: 0,
            y: 0,
            opacity: isMobile ? 0.34 : 0.52,
            scale: 1,
            filter: 'blur(0px) saturate(0.92)'
          },
          {
            x: path.x,
            y: path.y,
            opacity: 0.02,
            scale: 0.9,
            filter: 'blur(5px) saturate(0.82)',
            duration: 2,
            ease: 'power1.inOut',
            repeat: -1,
            repeatDelay: 0.16 + (index % 2 === 0 ? 0.04 : 0.11),
            delay: loopDelay
          }
        );
      });
    }, bentoScrollRef);

    return () => ctx.revert();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'leadership' || !leadershipHeaderRef.current) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    leadershipHeaderRef.current.focus({ preventScroll: true });
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'leadership' || !leadershipGridRef.current) {
      return;
    }

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray('.leadership-card');

      cards.forEach((card, index) => {
        gsap.fromTo(
          card,
          {
            x: index === 0 ? -72 : 72,
            opacity: 0
          },
          {
            x: 0,
            opacity: 1,
            duration: 1.5,
            ease: 'power3.out',
            delay: index * 0.14,
            clearProps: 'transform,opacity'
          }
        );
      });
    }, leadershipGridRef);

    return () => ctx.revert();
  }, [activeSection]);

  useEffect(() => {
    const teamSummary = SECTION_CONTENT.teamMembers.profile.summary;
    const sallySummary = SECTION_CONTENT.sallyHuang.profile.summary;

    if (activeSection !== 'founder' && activeSection !== 'teamMembers' && activeSection !== 'sallyHuang') {
      setAnimatedTeamSummary(teamSummary);
      setAnimatedSallySummary(sallySummary);
      return;
    }

    let frameId;
    const summaryMap = {
      teamMembers: {
        text: teamSummary,
        setSummary: setAnimatedTeamSummary
      },
      sallyHuang: {
        text: sallySummary,
        setSummary: setAnimatedSallySummary
      }
    };
    const activeSummary = summaryMap[activeSection];
    if (!activeSummary) {
      return;
    }
    const summaryText = activeSummary.text;
    const setSummary = activeSummary.setSummary;
    const durationMs = 2000;
    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const nextLength = Math.ceil(summaryText.length * progress);
      setSummary(summaryText.slice(0, nextLength));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    setSummary('');
    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [activeSection]);

  const section = useMemo(() => SECTION_CONTENT[activeSection], [activeSection]);
  const setActiveSection = (nextSection) => {
    navigate(SECTION_ROUTES[nextSection] || SECTION_ROUTES.story);
  };
  const profile = section.profile;
  const isFounderShowcase = activeSection === 'founder';
  const useInlineProfileLayout =
    activeSection === 'founder' || activeSection === 'teamMembers' || activeSection === 'sallyHuang';
  const isProfileShowcase = useInlineProfileLayout;
  const usesFounderDetailStyles = activeSection === 'founder' || activeSection === 'sallyHuang';
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
                <div className="about-story-hero-particles" aria-hidden="true">
                  {HERO_PARTICLES.map((particle) => (
                    <span
                      key={particle.key}
                      className={`about-story-hero-particle about-story-hero-particle-${particle.size} about-story-hero-particle-${particle.layer}`}
                      style={{
                        '--particle-left': particle.left || 'auto',
                        '--particle-right': particle.right || 'auto',
                        '--particle-top': particle.top,
                        '--particle-duration': particle.duration,
                        '--particle-delay': particle.delay,
                        '--particle-wave': particle.wave,
                        '--particle-row': particle.row
                      }}
                    />
                  ))}
                </div>
                <div className="about-story-hero-title-block" role="heading" aria-level="2">
                  <p className="about-story-hero-manifesto-line about-story-hero-manifesto-line-lead mb-0">
                    Real Execution is Rare
                  </p>
                  <p className="about-story-hero-manifesto-line about-story-hero-manifesto-line-trail mb-0">
                    Join the Executors
                  </p>
                </div>
              </section>

              <section className="about-bento-scroll-section" ref={bentoScrollRef} aria-label="Bento scroll hero">
                <div className="about-bento-scroll-pin">
                  <div className="about-bento-scroll-stage">
                    <div className="about-bento-scroll-copy">
                      <h3 className="about-bento-scroll-title mb-2">Why We Exist</h3>
                      <p className="about-bento-scroll-subtitle mb-2">
                        Ideas don&apos;t change the present — action does.
                      </p>
                      <p className="about-bento-scroll-subtitle mb-2">
                        We built tsumit to turn shared knowledge into real execution.
                      </p>
                      <p className="about-bento-scroll-subtitle mb-2">
                        From one person&apos;s vision to a growing community — this is a place where you don&apos;t
                        just learn, you do.
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
                  <p className="about-bento-scroll-subtitle mb-2">
                    Tsumit grew from a single vision into a space where you can learn, execute, and grow
                    alongside others.
                  </p>
                  <p className="about-bento-scroll-subtitle about-leadership-cta-note mb-0">
                    We want you to know us — and we&apos;d love to hear from you too.
                  </p>
                  <Link
                    to={SECTION_ROUTES.leadership}
                    className="about-bento-scroll-link d-inline-flex text-decoration-none"
                  >
                    Meet Our Team
                  </Link>
                </div>
              </section>

              <section className="about-direction-section">
                <header className="about-section-head text-center pt-2">
                  <h3 className="about-bento-scroll-title mb-2">Long-Term Direction</h3>
                </header>

                <div className="about-longterm-stage">
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

                  <div className="about-longterm-ground" aria-hidden="true">
                    <img
                      src={`${process.env.PUBLIC_URL}/images/11111.png`}
                      alt=""
                      className="about-longterm-ground-image"
                    />
                  </div>
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
                <section className="about-why-exist-feature" aria-label="Why we are building this">
                  <div className="about-why-exist-copy">
                    <p className="about-why-exist-eyebrow mb-0">{WHY_WE_EXIST_FEATURE.eyebrow}</p>
                    <div className="about-why-exist-body">
                      {WHY_WE_EXIST_FEATURE.body.map((paragraph) => (
                        <p key={paragraph} className="about-why-exist-text mb-0">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                    <Link to={WHY_WE_EXIST_FEATURE.ctaTo} className="about-why-exist-link text-decoration-none">
                      {WHY_WE_EXIST_FEATURE.ctaLabel}
                    </Link>
                  </div>

                  <div className="about-why-exist-visual">
                    <img
                      src={WHY_WE_EXIST_FEATURE.image}
                      alt={WHY_WE_EXIST_FEATURE.imageAlt}
                      className="about-why-exist-image"
                    />
                  </div>
                </section>
              </div>
            </section>
          </div>
        ) : activeSection === 'leadership' ? (
          <div className="col-lg-12">
            <section className="leadership-panel leadership-panel-showcase h-100">
              <header className="leadership-hero leadership-hero-showcase" ref={leadershipHeaderRef} tabIndex={-1}>
                <nav className="about-breadcrumb" aria-label="Breadcrumb">
                  <Link
                    to={SECTION_ROUTES.story}
                    className="about-breadcrumb-link text-decoration-none"
                  >
                    <span className="about-breadcrumb-root">About</span>
                  </Link>
                  <span className="about-breadcrumb-separator" aria-hidden="true">›</span>
                  <span className="about-breadcrumb-current">Team Members</span>
                </nav>
                <h2 className="leadership-hero-title mb-0">{section.heroTitle}</h2>
                {section.heroCopy ? <p className="leadership-hero-copy mb-0">{section.heroCopy}</p> : null}
              </header>

              <div className="leadership-grid leadership-grid-showcase" ref={leadershipGridRef}>
                {section.members.map((member) => (
                  <article key={member.key} className="leadership-card leadership-card-showcase">
                    <div className="leadership-card-main leadership-card-main-showcase">
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
            <div
              className={`col-lg-8 about-detail-col ${
                useInlineProfileLayout ? 'about-detail-col-centered' : ''
              } ${isProfileShowcase ? 'about-detail-col-profile-showcase' : ''} ${
                isFounderShowcase ? 'about-detail-col-founder-showcase' : ''
              }`.trim()}
            >
              <div className="about-detail-breadcrumb-row">
                <nav className="about-breadcrumb" aria-label="Breadcrumb">
                  <Link
                    to={SECTION_ROUTES.story}
                    className="about-breadcrumb-link text-decoration-none"
                  >
                    <span className="about-breadcrumb-root">About</span>
                  </Link>
                  <span className="about-breadcrumb-separator" aria-hidden="true">›</span>
                  <Link
                    to={SECTION_ROUTES.leadership}
                    className="about-breadcrumb-link text-decoration-none"
                  >
                    <span className="about-breadcrumb-section">Team Members</span>
                  </Link>
                  <span className="about-breadcrumb-separator" aria-hidden="true">›</span>
                  <span className="about-breadcrumb-current">{profile.name}</span>
                </nav>
              </div>
              <section
                className={`about-story-panel about-detail-panel h-100 ${
                  useInlineProfileLayout ? '' : 'panel'
                } ${useInlineProfileLayout ? 'about-detail-panel-centered' : ''} ${
                  isProfileShowcase ? 'about-detail-panel-profile-showcase' : ''
                } ${
                  isFounderShowcase ? 'about-detail-panel-founder-showcase' : ''
                }`.trim()}
              >
                <div
                  className={`about-story-block ${
                    useInlineProfileLayout ? 'about-team-intro-block' : ''
                  } ${isProfileShowcase ? 'about-story-block-profile-hero' : ''} ${
                    isFounderShowcase ? 'about-story-block-founder-hero' : ''
                  }`.trim()}
                >
                  {useInlineProfileLayout ? (
                    <div className="about-inline-portrait-shell" aria-hidden="true">
                      <img
                        src={profile.image}
                        alt={profile.imageAlt}
                        className="about-inline-portrait-image"
                      />
                    </div>
                  ) : null}
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
                      usesFounderDetailStyles ? 'about-story-copy-highlight' : ''
                    } ${usesFounderDetailStyles ? 'about-story-copy-story-match' : ''} ${
                      activeSection === 'teamMembers' ? 'about-story-copy-plain' : ''
                    } ${usesFounderDetailStyles ? 'about-founder-summary-offset' : ''
                    } ${activeSection === 'founder' || activeSection === 'teamMembers' || activeSection === 'sallyHuang'
                      ? 'about-founder-summary-fixed-lines'
                      : ''
                    } ${activeSection === 'sallyHuang' ? 'about-sally-summary-fixed-lines' : ''
                    }`}
                  >
                    {activeSection === 'founder'
                      ? (
                        <span className="about-founder-summary-lines">
                          <span className="about-founder-summary-line">Building a technical community where</span>
                          <span className="about-founder-summary-line">people learn by shipping, explaining,</span>
                          <span className="about-founder-summary-line">and sharing what actually works.</span>
                        </span>
                      )
                      : activeSection === 'teamMembers'
                        ? (
                          <span className="about-founder-summary-lines">
                            <span className="about-founder-summary-line">Experienced across different domains,</span>
                            <span className="about-founder-summary-line">building cross-disciplinary coordination</span>
                            <span className="about-founder-summary-line">and collaboration to move products forward.</span>
                          </span>
                        )
                      : activeSection === 'sallyHuang'
                        ? (
                          <span className="about-founder-summary-lines">
                            <span className="about-founder-summary-line">Shaping how the world sees, feels,</span>
                            <span className="about-founder-summary-line">and interacts with ideas through</span>
                            <span className="about-founder-summary-line">the craft of visual design.</span>
                          </span>
                        )
                      : profile.summary}
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
                      {usesFounderDetailStyles && block.kicker === 'What I Bring' ? (
                        <p className="about-story-copy about-story-copy-story-match mb-0">
                          {[block.title, block.copy].filter(Boolean).join(' ')}
                        </p>
                      ) : (
                        <>
                          <h3
                            className={`about-story-title ${
                              usesFounderDetailStyles ? 'about-story-title-story-match' : ''
                            }`}
                          >
                            {block.title}
                          </h3>
                          <p
                            className={`about-story-copy mb-0 ${
                              usesFounderDetailStyles ? 'about-story-copy-story-match' : ''
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
                      engineering execution, and translating complexity into clarity. At tsumit, I channel
                      this into building products that are not just functional, but thoughtfully crafted and
                      built to last.
                    </p>
                  </div>
                )}

                <div className="about-story-block is-last">
                  {profile.location ? (
                    <div className="about-connect-list">
                      <div className="about-connect-row">
                        <span className="about-connect-label about-story-kicker-highlight">Location</span>
                        <span className="about-connect-value">{profile.location}</span>
                      </div>
                    </div>
                  ) : null}

                  {profile.email || profile.links.length ? (
                    <div className="founder-link-row mt-3">
                      {profile.email ? (
                        <a
                          href={`mailto:${profile.email}`}
                          className="founder-link-pill"
                        >
                          Email
                        </a>
                      ) : null}
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
                  ) : null}

                </div>
              </section>
            </div>

            <div
              className={`col-lg-4 about-detail-portrait-col ${
                useInlineProfileLayout ? 'about-detail-portrait-col-hidden' : ''
              } ${isProfileShowcase ? 'about-detail-portrait-col-profile-showcase' : ''} ${
                isFounderShowcase ? 'about-detail-portrait-col-founder-showcase' : ''
              }`.trim()}
            >
              <section
                className={`about-portrait-panel h-100 ${
                  isProfileShowcase ? 'about-portrait-panel-profile-showcase' : ''
                } ${isFounderShowcase ? 'about-portrait-panel-founder-showcase' : ''}`.trim()}
              >
                <img
                  src={profile.image}
                  alt={profile.imageAlt}
                  className={`about-portrait-image ${
                    isProfileShowcase ? 'about-portrait-image-profile-showcase' : ''
                  } ${isFounderShowcase ? 'about-portrait-image-founder-showcase' : ''}`.trim()}
                />
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
