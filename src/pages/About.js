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
          <section className="panel mb-4">
            <h4>Why I Built LearnFromUs</h4>
            <p className="mb-0 muted">
              Too much technical learning is passive. LearnFromUs is designed around sharing real
              implementations, practical hacks, and product lessons from builders who are actively shipping.
            </p>
          </section>

          <section className="panel mb-4">
            <h4>What I Focus On</h4>
            <p className="mb-2">
              I lead product direction and engineering execution, with a focus on:
            </p>
            <ul className="mb-0">
              <li>Developer tools and community features that encourage high-quality contributions</li>
              <li>AI-assisted workflows that improve shipping speed without sacrificing quality</li>
              <li>Modern full-stack systems using React, TypeScript, and scalable backend architecture</li>
            </ul>
          </section>

          <section className="panel">
            <h4>Vision</h4>
            <p className="mb-0 muted">
              Build a forum where learning is public, proof of skill is visible, and career growth comes
              from what you can build and explain, not just what you claim on paper.
            </p>
          </section>
        </div>

        <div className="col-lg-5">
          <section className="glass-card founder-profile-panel p-3 p-lg-4">
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
