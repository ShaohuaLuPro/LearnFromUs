import React from 'react';
import { Link } from 'react-router-dom';

export default function Legal() {
  return (
    <div className="container page-shell">
      <nav className="about-breadcrumb mb-3" aria-label="Breadcrumb">
        <Link to="/about" className="about-breadcrumb-link text-decoration-none">
          <span className="about-breadcrumb-root">About</span>
        </Link>
        <span className="about-breadcrumb-separator" aria-hidden="true">›</span>
        <span className="about-breadcrumb-current">Legal</span>
      </nav>
      <section className="panel terms-page">
        <p className="type-kicker terms-page-kicker mb-2">Legal</p>
        <p className="type-body mb-3">Last updated: March 2026</p>

        <h2 className="type-title-sm mb-2">Disclaimer</h2>
        <p className="type-body mb-3">
          The content published on LearnFromUs — including posts, discussions, shared resources, and any other
          materials — is provided for informational and educational purposes only. LearnFromUs does not guarantee the
          accuracy, completeness, or reliability of any content shared by community members.
        </p>
        <p className="type-body mb-3">
          Participation in this community does not constitute professional advice of any kind, including but not
          limited to legal, financial, medical, or business advice. Always consult a qualified professional before
          making decisions based on information found on this platform.
        </p>
        <p className="type-body mb-3">
          LearnFromUs is not liable for any loss or damage arising from your use of, or reliance on, any content
          found on this platform.
        </p>

        <h2 className="type-title-sm mb-2">Terms of Service</h2>
        <p className="type-body mb-3">
          By accessing or using LearnFromUs, you agree to be bound by these Terms of Service. If you do not agree,
          please do not use the platform.
        </p>

        <h2 className="type-title-sm mb-2">Eligibility</h2>
        <p className="type-body mb-3">
          You must be at least 13 years of age to use LearnFromUs. By creating an account, you confirm that you meet
          this requirement.
        </p>

        <h2 className="type-title-sm mb-2">Your Account</h2>
        <p className="type-body mb-3">
          You are responsible for maintaining the confidentiality of your account credentials. Any activity that occurs
          under your account is your responsibility. Notify us immediately if you suspect unauthorized access.
        </p>

        <h2 className="type-title-sm mb-2">User Content</h2>
        <p className="type-body mb-3">
          You retain ownership of the content you post on LearnFromUs. By posting, you grant LearnFromUs a
          non-exclusive, royalty-free license to display and distribute your content within the platform. You are
          solely responsible for ensuring your content does not violate any applicable laws or third-party rights.
        </p>

        <h2 className="type-title-sm mb-2">Prohibited Conduct</h2>
        <p className="type-body mb-3">You agree not to:</p>
        <p className="type-body mb-3">
          Post content that is harmful, illegal, or violates the rights of others
          <br />
          Attempt to access, disrupt, or interfere with the platform&apos;s systems
          <br />
          Impersonate any person or entity
          <br />
          Use the platform for any commercial solicitation without prior approval
        </p>

        <h2 className="type-title-sm mb-2">Termination</h2>
        <p className="type-body mb-3">
          LearnFromUs reserves the right to suspend or terminate any account that violates these Terms, at our sole
          discretion and without prior notice.
        </p>

        <h2 className="type-title-sm mb-2">Limitation of Liability</h2>
        <p className="type-body mb-3">
          To the fullest extent permitted by applicable law, LearnFromUs shall not be liable for any indirect,
          incidental, or consequential damages arising from your use of the platform.
        </p>

        <h2 className="type-title-sm mb-2">Governing Law</h2>
        <p className="type-body mb-3">
          These Terms are governed by the laws of the United States. Any disputes shall be resolved in accordance with
          applicable U.S. federal and state law.
        </p>

        <h2 className="type-title-sm mb-2">Copyright Notice</h2>
        <p className="type-body mb-3">© 2026 LearnFromUs. All rights reserved.</p>
        <p className="type-body mb-3">
          All original content, design, and materials on LearnFromUs are the intellectual property of LearnFromUs
          unless otherwise stated. You may not reproduce, distribute, or use any platform content without prior
          written permission.
        </p>
        <p className="type-body mb-0">
          Content posted by community members remains the property of the respective authors. If you believe any
          content on this platform infringes your copyright, please contact us and we will respond promptly.
        </p>
      </section>
    </div>
  );
}
