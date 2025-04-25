import React from 'react';
import { Card } from 'react-bootstrap';

export default function Home() {
  return (
    <div className="container mt-5 pt-5">
      <Card className="p-4 shadow-sm">
        <h1 className="mb-3">Welcome to LearnFromUs</h1>
        <p className="lead">
          A collaborative platform where knowledge meets opportunity.
        </p>
        <ul>
          <li><strong>🎓 Students</strong> — Learn with interactive demos, tutorials, and visualized algorithms to strengthen your understanding of computer science and machine learning.</li>
          <li><strong>🧑‍💻 Professionals</strong> — Publish your work, build your portfolio, and contribute learning resources that inspire the next generation.</li>
          <li><strong>🏢 Companies</strong> — Discover skilled individuals through live projects and transparent portfolios that showcase real technical abilities.</li>
        </ul>
        <p className="mt-3">
          Whether you're here to learn, showcase, or hire — you're in the right place.
        </p>
      </Card>
    </div>
  );
}
