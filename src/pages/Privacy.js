import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
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
        <span className="about-breadcrumb-current">Privacy</span>
      </nav>
      <section className="panel terms-page">
        <p className="type-kicker privacy-page-kicker mb-2">Privacy</p>
        <p className="type-body mb-3">Last updated: March 2026</p>
        <p className="type-body mb-4">
          At tsumit, your privacy matters. This policy explains what data we collect, how we use it, and how we
          protect it.
        </p>

        <h2 className="type-title-sm mb-2">1. What We Collect</h2>
        <p className="type-body mb-3">
          When you join tsumit, we may collect the following:
        </p>
        <p className="type-body mb-3">
          Name — to personalize your experience
          <br />
          Email address — to manage your account and send notifications
          <br />
          Profile information &amp; avatar — to build your community presence
          <br />
          Usage data — including how you interact with the platform, pages visited, and features used
        </p>

        <h2 className="type-title-sm mb-2">2. How We Use Your Data</h2>
        <p className="type-body mb-3">
          We use your information to:
        </p>
        <p className="type-body mb-3">
          Send platform updates, announcements, and relevant notifications
          <br />
          Improve the overall experience and functionality of tsumit
          <br />
          Analyze platform usage through third-party analytics tools (e.g. Google Analytics or similar)
        </p>
        <p className="type-body mb-3">We do not sell or share your personal data with third parties for marketing purposes.</p>

        <h2 className="type-title-sm mb-2">3. Third-Party Tools</h2>
        <p className="type-body mb-3">
          We may use trusted third-party analytics tools to understand how our community uses the platform. These
          tools may collect anonymized usage data. They are bound by their own privacy policies and do not have access
          to your personal identifiable information beyond what is necessary.
        </p>

        <h2 className="type-title-sm mb-2">4. Your Rights</h2>
        <p className="type-body mb-3">
          You have the right to:
        </p>
        <p className="type-body mb-3">
          Access the personal data we hold about you
          <br />
          Request correction or deletion of your data
          <br />
          Opt out of non-essential communications at any time
        </p>

        <h2 className="type-title-sm mb-2">5. Data Security</h2>
        <p className="type-body mb-3">
          We take reasonable measures to protect your information. However, no platform can guarantee absolute
          security. Please use a strong password and keep your account credentials safe.
        </p>

        <h2 className="type-title-sm mb-2">6. Changes to This Policy</h2>
        <p className="type-body mb-0">
          We may update this Privacy Policy from time to time. We&apos;ll notify you of significant changes via email
          or platform announcement.
        </p>
      </section>
    </div>
  );
}
