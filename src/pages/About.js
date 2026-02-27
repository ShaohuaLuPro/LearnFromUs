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
          <section className="glass-card p-4 h-100">
            <h4 className="mb-3">Connect</h4>
            <p className="mb-2"><strong>Name:</strong> Shaohua Lu</p>
            <p className="mb-2"><strong>Role:</strong> Founder, LearnFromUs</p>
            <p className="mb-2"><strong>Location:</strong> Boston, MA</p>
            <p className="mb-2">
              <strong>Email:</strong>{' '}
              <a href="mailto:tomlu1234567@gmail.com">tomlu1234567@gmail.com</a>
            </p>
            <p className="mb-2">
              <strong>LinkedIn:</strong>{' '}
              <a href="https://www.linkedin.com/in/shaohualu/" target="_blank" rel="noreferrer">
                linkedin.com/in/shaohualu
              </a>
            </p>
            <p className="mb-0">
              <strong>GitHub:</strong>{' '}
              <a href="https://github.com/ShaohuaLuPro" target="_blank" rel="noreferrer">
                github.com/ShaohuaLuPro
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
