import React from 'react';

export default function Privacy() {
  return (
    <div className="container page-shell">
      <section className="panel">
        <p className="type-kicker mb-2">Privacy</p>
        <h1 className="type-title-md mb-3">Privacy Notice</h1>
        <p className="type-body mb-3">Last updated: March 27, 2026</p>

        <h2 className="type-title-sm mb-2">1. What We Collect</h2>
        <p className="type-body mb-3">
          We collect account profile information, forum and post activity, and moderation or request workflow data
          needed to operate LearnFromUs.
        </p>

        <h2 className="type-title-sm mb-2">2. How Data Is Used</h2>
        <p className="type-body mb-3">
          Data is used to provide core features such as publishing posts, following creators, forum management,
          moderation review, and account security.
        </p>

        <h2 className="type-title-sm mb-2">3. AI-Assisted Features</h2>
        <p className="type-body mb-3">
          Some workflows may offer AI-assisted draft improvements. Inputs are processed for feature functionality and
          quality improvement within the product experience.
        </p>

        <h2 className="type-title-sm mb-2">4. Access and Retention</h2>
        <p className="type-body mb-3">
          Access to sensitive operations is role-based (for example, moderation or admin tools). Data is retained as
          required to run platform features and maintain safety logs.
        </p>

        <h2 className="type-title-sm mb-2">5. Your Controls</h2>
        <p className="type-body mb-3">
          You can update profile details, update credentials, and request account deletion through account settings,
          where available in-app.
        </p>

        <h2 className="type-title-sm mb-2">6. Updates to This Notice</h2>
        <p className="type-body mb-0">
          We may revise this page when product behavior changes. Continued use after updates means you acknowledge the
          revised privacy notice.
        </p>
      </section>
    </div>
  );
}
