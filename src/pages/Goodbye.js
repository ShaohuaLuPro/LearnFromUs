import React from 'react';
import { Link } from 'react-router-dom';

export default function Goodbye() {
  return (
    <div className="container page-shell">
      <section className="goodbye-card">
        <p className="landing-eyebrow">Account Removed</p>
        <h1 className="goodbye-title">Sorry to see you go.</h1>
        <p className="goodbye-copy">
          Your account and posts have been removed. If you want to come back later, you can always create a
          new account and start fresh.
        </p>
        <div className="landing-actions">
          <Link to="/" className="forum-primary-btn text-decoration-none">
            Return Home
          </Link>
          <Link to="/login" className="forum-secondary-btn text-decoration-none">
            Create a New Account
          </Link>
        </div>
      </section>
    </div>
  );
}
