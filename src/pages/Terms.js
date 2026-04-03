import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  const pageTopRef = useRef(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    pageTopRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="container page-shell">
      <nav className="about-breadcrumb mb-3" aria-label="Breadcrumb" ref={pageTopRef} tabIndex={-1}>
        <Link to="/about" className="about-breadcrumb-link text-decoration-none">
          <span className="about-breadcrumb-root">About</span>
        </Link>
        <span className="about-breadcrumb-separator" aria-hidden="true">›</span>
        <span className="about-breadcrumb-current">Terms</span>
      </nav>
      <section className="panel terms-page">
        <p className="type-kicker terms-page-kicker mb-2">Terms</p>
        <p className="type-body mb-3">Last updated: March 2026</p>
        <p className="type-body mb-4">
          Welcome to LearnFromUs. This is a space built on shared knowledge, honest execution, and mutual respect.
          By joining our community, you agree to the following terms.
        </p>

        <h2 className="type-title-sm mb-2">1. Be Respectful</h2>
        <p className="type-body mb-3">
          Treat every member with respect. Healthy debate is encouraged — personal attacks, harassment, or
          discriminatory language of any kind will not be tolerated.
        </p>

        <h2 className="type-title-sm mb-2">2. Post with Purpose</h2>
        <p className="type-body mb-3">
          Share content that adds value. Spam, self-promotion without contribution, and off-topic posts may be removed
          at the discretion of our moderators.
        </p>

        <h2 className="type-title-sm mb-2">3. Give Honest Feedback</h2>
        <p className="type-body mb-3">
          When leaving comments or reviews on others&apos; work, be constructive. Feedback should help people grow
          — not tear them down.
        </p>

        <h2 className="type-title-sm mb-2">4. Respect Privacy in Direct Messages</h2>
        <p className="type-body mb-3">
          Private conversations stay private. Screenshots or sharing of DMs without consent is a violation of
          community trust and may result in account suspension.
        </p>

        <h2 className="type-title-sm mb-2">5. Share Responsibly</h2>
        <p className="type-body mb-3">
          When sharing resources or files, ensure you have the right to share them. Do not upload copyrighted
          material without permission.
        </p>

        <h2 className="type-title-sm mb-2">6. No Misinformation</h2>
        <p className="type-body mb-3">
          Share what you know — but be honest about what you don&apos;t. Deliberately spreading false information
          undermines the trust this community is built on.
        </p>

        <h2 className="type-title-sm mb-2">7. Consequences</h2>
        <p className="type-body mb-4">
          Violations of these terms may result in content removal, temporary suspension, or permanent ban, depending
          on severity.
        </p>

        <p className="type-body mb-0">
          LearnFromUs reserves the right to update these terms at any time. Continued use of the platform constitutes
          acceptance of any changes.
        </p>
      </section>
    </div>
  );
}
