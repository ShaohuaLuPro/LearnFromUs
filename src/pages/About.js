import React, { useMemo, useState } from 'react';

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
          'Stop passive learning. In software and data, most tutorials are bookmarked and forgotten. LearnFromUs is the opposite. We pull back the curtain on real implementation—shipping, debugging, and architecture—providing the practical hacks that actual builders need to execute.'
      },
      {
        kicker: 'Long-Term Direction',
        title: '—— To build a platform where proof of skill is woven into the product.',
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
      eyebrow: 'Profile',
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
      eyebrow: 'Profile',
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

// This is a simple modification to the About.js file without affecting existing content

export default function About() {
  const [activeSection, setActiveSection] = useState('story');
  const section = useMemo(() => SECTION_CONTENT[activeSection], [activeSection]);
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
  const sidebarItems = [
    { key: 'story', label: 'Story' },
    { key: 'leadership', label: 'Leadership' }
  ];

  return (
    <div className="container-fluid page-shell about-page-shell" data-page="about">
      <div className="row g-4">
        <div className="col-lg-3">
          <section className="glass-card about-sidebar-panel p-2 p-lg-3">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`about-sidebar-btn ${activeSection === item.key ? 'is-active' : ''}`}
                onClick={() => setActiveSection(item.key)}
              >
                {item.label}
              </button>
            ))}
          </section>
        </div>

        {activeSection === 'story' ? (
          <div className="col-lg-9">
            <section className="panel about-story-panel h-100">
              {section.blocks.map((block, idx) => (
                <div
                  key={block.kicker}
                  className={`about-story-block ${idx === section.blocks.length - 1 ? 'is-last' : ''}`}
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
                  {block.kicker === 'Why This Exists' ? (
                    <h3 className="about-story-title about-story-title-why">
                      —— To make technical learning{' '}
                      <span className="about-word-bounce about-word-bounce-delay-0">more public</span>{' '}
                      and{' '}
                      <span className="about-word-bounce about-word-bounce-delay-1">more useful</span>.
                    </h3>
                  ) : block.kicker === 'Long-Term Direction' ? (
                    <h3 className="about-story-title about-story-title-why">
                      —— To build a platform where{' '}
                      <span className="about-word-bounce about-word-bounce-delay-0">proof of skill</span>{' '}
                      is woven{' '}
                      <span className="about-word-bounce about-word-bounce-delay-1">into the product</span>.
                    </h3>
                  ) : (
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
                        <strong>Stop passive learning.</strong>{' '}
                        In software and data, most tutorials are bookmarked and forgotten.{' '}
                        <strong>LearnFromUs is the opposite.</strong>{' '}
                        We pull back the curtain on real implementation—<strong>shipping</strong>, <strong>debugging</strong>, and <strong>architecture</strong>—<strong>providing</strong> the practical hacks that actual builders need to execute.
                      </>
                    ) : block.kicker === 'Long-Term Direction' ? (
                      <>
                        Over time, LearnFromUs should become a place where strong work naturally stands out:
                        clear posts, strong examples, useful feedback, and visible patterns of execution. The
                        point is not to mimic a traditional social feed. The point is to build a technical
                        community where what you can <strong>explain</strong>, <strong>ship</strong>, and{' '}
                        <strong>improve</strong> is visible by default.
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
          <div className="col-lg-9">
            <section className="panel leadership-panel h-100">
              <header className="leadership-hero">
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
            <div className="col-lg-5 about-detail-col">
              <section className="panel about-story-panel about-detail-panel h-100">
                <div className="about-story-block">
                  <p
                    className={`about-story-kicker ${
                      highlightedLabels.has(profile.eyebrow) ? 'about-story-kicker-highlight' : ''
                    } ${
                      largeKickers.has(profile.eyebrow) ? 'about-story-kicker-xl' : ''
                    }`}
                  >
                    {profile.eyebrow}
                  </p>
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
                      bring that perspective into every team I join — bridging communication gaps, driving
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
                    <div className="about-connect-row">
                      <span className="about-connect-label about-story-kicker-highlight about-story-kicker-xl">Email</span>
                      <a href={`mailto:${profile.email}`}>{profile.email}</a>
                    </div>
                  </div>

                  <div className="founder-link-row mt-3">
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
