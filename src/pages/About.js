import React from 'react';

export default function About() {
  return (
    <div className="container page-shell">
      <section className="hero-card mb-4">
        <h1 className="hero-title mb-2">Founder</h1>
        <p className="hero-copy mb-0">
          I am Shaohua Lu, founder of LearnFromUs. I build practical products at the intersection of
          software engineering, AI, and community learning.
        </p>
      </section>

      <div className="row g-4">
        <div className="col-lg-7">
          <section className="panel about-story-panel h-100">
            <div className="about-story-block">
              <p className="about-story-kicker">Why This Exists</p>
              <h3 className="about-story-title">I built LearnFromUs to make technical learning more public and more useful.</h3>
              <p className="about-story-copy mb-0">
                Too much learning in software and data stays passive: people consume tutorials, save threads,
                and move on. LearnFromUs is designed around the opposite model. The goal is to make real
                implementation details visible through posts about shipping, debugging, architecture decisions,
                experiments, and practical hacks that other builders can actually use.
              </p>
            </div>

            <div className="about-story-block">
              <p className="about-story-kicker">What I Bring</p>
              <h3 className="about-story-title">My background spans product execution, software delivery, and data science.</h3>
              <p className="about-story-copy">
                I work across full-stack product development and applied AI, with experience in software
                engineering, analytics, machine learning, and team execution. That mix shapes how this
                platform is built: practical on the product side, structured on the engineering side, and
                rigorous about signal over noise.
              </p>
              <div className="about-focus-grid">
                <span className="about-focus-pill">Product + Engineering Leadership</span>
                <span className="about-focus-pill">React / TypeScript / Node</span>
                <span className="about-focus-pill">Data Science + Applied ML</span>
                <span className="about-focus-pill">Community Systems</span>
              </div>
            </div>

            <div className="about-story-block is-last">
              <p className="about-story-kicker">Long-Term Direction</p>
              <h3 className="about-story-title">The vision is a forum where proof of skill is built into the product.</h3>
              <p className="about-story-copy mb-0">
                Over time, LearnFromUs should become a place where strong work naturally stands out: clear
                posts, strong examples, useful feedback, and visible patterns of execution. The point is not
                to mimic a traditional social feed. The point is to build a technical community where what you
                can explain, ship, and improve is visible by default.
              </p>
            </div>
          </section>
        </div>

        <div className="col-lg-5">
          <section className="glass-card founder-profile-panel h-100 p-3 p-lg-4">
            <img
              src={`${process.env.PUBLIC_URL}/images/founder-portrait.jpg`}
              alt="Shaohua Lu"
              className="founder-profile-image"
            />

            <div className="founder-profile-body">
              <div>
                <div className="founder-eyebrow">Founder Profile</div>
                <h4 className="mb-1">Shaohua Lu</h4>
                <p className="muted mb-0">Founder, LearnFromUs</p>
              </div>

              <p className="mb-0 muted">
                Building a technical community where people learn by shipping, explaining, and sharing
                what actually works.
              </p>

              <div className="about-connect-list">
                <div className="about-connect-row">
                  <span className="about-connect-label">Location</span>
                  <span>Boston, MA</span>
                </div>
                <div className="about-connect-row">
                  <span className="about-connect-label">Email</span>
                  <a href="mailto:tomlu1234567@gmail.com">tomlu1234567@gmail.com</a>
                </div>
              </div>

              <div className="founder-link-row">
                <a
                  href="https://www.linkedin.com/in/shaohualu/"
                  target="_blank"
                  rel="noreferrer"
                  className="founder-link-pill"
                >
                  LinkedIn
                </a>
                <a
                  href="https://github.com/ShaohuaLuPro"
                  target="_blank"
                  rel="noreferrer"
                  className="founder-link-pill"
                >
                  GitHub
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
