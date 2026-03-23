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
          'Too much learning in software and data stays passive: people consume tutorials, save threads, and move on. LearnFromUs is designed around the opposite model. The goal is to make real implementation details visible through posts about shipping, debugging, architecture decisions, experiments, and practical hacks that other builders can actually use.'
      },
      {
        kicker: 'Long-Term Direction',
        title: 'The vision is a forum where proof of skill is built into the product.',
        copy:
          'Over time, LearnFromUs should become a place where strong work naturally stands out: clear posts, strong examples, useful feedback, and visible patterns of execution. The point is not to mimic a traditional social feed. The point is to build a technical community where what you can explain, ship, and improve is visible by default.'
      }
    ]
  },
  founder: {
    heroTitle: 'Founder',
    heroCopy:
      'I am Shaohua Lu, founder of LearnFromUs. I build practical products at the intersection of software engineering, AI, and community learning.',
    profile: {
      eyebrow: 'Founder Profile',
      name: 'Shaohua Lu',
      role: 'Founder, LearnFromUs',
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
  teamMember: {
    heroTitle: 'Team Member',
    heroCopy:
      'Meet Ben He, a software developer contributing to LearnFromUs with cross-functional experience and collaborative execution.',
    profile: {
      eyebrow: 'Team Member Profile',
      name: 'Ben He',
      role: 'Software Developer',
      summary:
        'Experienced across different domains, building cross-disciplinary coordination and collaboration to move products forward.',
      location: 'Boston, MA',
      email: 'bigbenokk@gmail.com',
      image: `${process.env.PUBLIC_URL}/images/ben-he.jpg`,
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

export default function About() {
  const [activeSection, setActiveSection] = useState('story');
  const section = useMemo(() => SECTION_CONTENT[activeSection], [activeSection]);
  const profile = section.profile;

  return (
    <div className="container-fluid page-shell about-page-shell" data-page="about">
      <div className="row g-4">
        <div className="col-lg-3">
          <section className="glass-card about-sidebar-panel p-2 p-lg-3">
            <button
              type="button"
              className={`about-sidebar-btn ${activeSection === 'story' ? 'is-active' : ''}`}
              onClick={() => setActiveSection('story')}
            >
              Story
            </button>
            <button
              type="button"
              className={`about-sidebar-btn ${activeSection === 'founder' ? 'is-active' : ''}`}
              onClick={() => setActiveSection('founder')}
            >
              Founder
            </button>
            <button
              type="button"
              className={`about-sidebar-btn ${activeSection === 'teamMember' ? 'is-active' : ''}`}
              onClick={() => setActiveSection('teamMember')}
            >
              Team Member
            </button>
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
                  <p className="about-story-kicker">{block.kicker}</p>
                  <h3 className="about-story-title">{block.title}</h3>
                  <p className="about-story-copy mb-0">{block.copy}</p>
                </div>
              ))}
            </section>
          </div>
        ) : (
          <>
            <div className="col-lg-5">
              <section className="panel about-story-panel about-detail-panel h-100">
                <div className="about-story-block">
                  <p className="about-story-kicker">{profile.eyebrow}</p>
                  <h3 className="about-story-title mb-2">{profile.name}</h3>
                  <p className="about-story-copy mb-2">{profile.role}</p>
                  <p className="about-story-copy mb-0">{profile.summary}</p>
                </div>

                {section.blocks.length > 0 ? (
                  section.blocks.map((block, idx) => (
                    <div
                      key={block.kicker}
                      className="about-story-block"
                    >
                      <p className="about-story-kicker">{block.kicker}</p>
                      <h3 className="about-story-title">{block.title}</h3>
                      <p className="about-story-copy mb-0">{block.copy}</p>
                    </div>
                  ))
                ) : (
                  <div className="about-story-block">
                    <p className="about-story-kicker">What I Bring</p>
                    <h3 className="about-story-title">Hands-on collaboration across technical and product work.</h3>
                    <p className="about-story-copy mb-0">
                      Ben contributes with practical delivery, cross-functional communication, and engineering execution to support LearnFromUs.
                    </p>
                  </div>
                )}

                <div className="about-story-block is-last">
                  <div className="about-connect-list">
                    <div className="about-connect-row">
                      <span className="about-connect-label">Location</span>
                      <span className="about-connect-value">{profile.location}</span>
                    </div>
                    <div className="about-connect-row">
                      <span className="about-connect-label">Email</span>
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
              <section className="glass-card about-portrait-panel h-100 p-2 p-lg-3">
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
