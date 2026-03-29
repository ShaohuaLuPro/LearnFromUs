import React from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="container page-shell">
      <section className="panel">
        <p className="type-kicker mb-2">Terms</p>
        <h1 className="type-title-md mb-3">Terms of Use</h1>
        <p className="type-body mb-3">Last updated: March 27, 2026</p>

        <h2 className="type-title-sm mb-2">1. Platform Purpose</h2>
        <p className="type-body mb-3">
          LearnFromUs is a community for practical knowledge-sharing. Members can publish posts, join forums,
          follow builders, and discuss implementation across software, AI, and everyday skill domains.
        </p>

        <h2 className="type-title-sm mb-2">2. Accounts and Access</h2>
        <p className="type-body mb-3">
          You are responsible for your account activity. Some features require login, including posting, following,
          and requesting forum actions. Administrative tools are permission-gated.
        </p>

        <h2 className="type-title-sm mb-2">3. Community Content Rules</h2>
        <p className="type-body mb-3">
          Keep content constructive, lawful, and relevant to forum topics. Do not post harmful, abusive, or
          intentionally misleading material. Moderators and authorized admins may review and take action on content
          when needed.
        </p>

        <h2 className="type-title-sm mb-2">4. User Content and Responsibility</h2>
        <p className="type-body mb-3">
          You keep ownership of content you submit, but you grant LearnFromUs permission to host, display, and process
          it for platform operation. You are responsible for ensuring your content does not violate others&apos; rights.
        </p>

        <h2 className="type-title-sm mb-2">5. Product Changes</h2>
        <p className="type-body mb-3">
          Features, route access, and moderation flows may evolve over time. We may update or remove parts of the
          service to keep quality, safety, and reliability aligned with community needs.
        </p>

        <h2 className="type-title-sm mb-2">6. Contact and Support</h2>
        <p className="type-body mb-0">
          For account or policy questions, use the <Link to="/forums/request">Support request page</Link>.
        </p>
      </section>
    </div>
  );
}
