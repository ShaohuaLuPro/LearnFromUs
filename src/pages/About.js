import React from 'react';

export default function About() {
  return (
    <div className="container mt-5 pt-5">
      <div className="row">
        {/* Left: Brief intro or photo */}
        <div className="col-md-4 mb-4">
          <h2>About Me</h2>
          <p>Hi! I'm Shaohua Lu, a data scientist passionate about building smart tools and interfaces using data, code, and machine learning.</p>
          <p>📍 Based in Weymouth, MA</p>
        </div>

        {/* Right: Resume */}
        <div className="col-md-8">
          <h4>Resume</h4>
          <p><strong>Shaohua Lu</strong><br />
          Weymouth, MA 02190 ▪ 267-328-7664 ▪ <a href="mailto:tomlu1234567@gmail.com">tomlu1234567@gmail.com</a><br />
          <a href="https://www.linkedin.com/in/shaohualu/" target="_blank" rel="noreferrer">LinkedIn</a> ▪ 
          <a href="https://github.com/ShaohuaLu97" target="_blank" rel="noreferrer"> GitHub</a>
          </p>

          <h5>Education</h5>
          <ul>
            <li><strong>Tufts University</strong>, MS in Data Science (May 2025)</li>
            <li><strong>Northeastern University</strong>, MS in Information Systems (May 2022)</li>
            <li><strong>Drexel University</strong>, BS in Business Admin - MIS & Business Analytics (March 2020)</li>
          </ul>

          <h5>Skills</h5>
          <ul>
            <li><strong>Programming:</strong> Python, SQL, HTML5, CSS, JavaScript, Bootstrap, MongoDB, React, Node.js, Spring, R, REST API, OpenCV</li>
            <li><strong>Analytics:</strong> Pandas, NumPy, ML, Classification, Clustering, NLP, Random Forest, XGBoost, Statistical Analysis, Excel, LP</li>
            <li><strong>Visualization:</strong> D3.js, Tableau, Matplotlib, Seaborn, Figma, Moqups, Balsamiq, Axure</li>
          </ul>

          <h5>Professional Experience</h5>
          <p><strong>Tech Brain Solution</strong>, Front-End Web Developer (July 2022 – May 2023)</p>
          <ul>
            <li>Revamped 12 certification pages with modern, responsive UI using Bootstrap & custom CSS.</li>
            <li>Built Accordion, Progress Bar, and interactive features using React and Font Awesome.</li>
          </ul>

          <p><strong>China MinSheng Bank</strong>, Data Analyst Intern (July 2019 – Sept 2019)</p>
          <ul>
            <li>Digitized customer data with Excel + VLOOKUP, used R for ML analysis & segmentation.</li>
          </ul>

          <h5>Project Experience</h5>
          <p><strong>Boston Touring</strong> – E-commerce site using MERN stack (Sept 2021 – Dec 2021)</p>
          <ul>
            <li>Built secure user auth (bcrypt + JWT), product CRUD, MongoDB backend, Cloudinary image storage.</li>
            <li>Used Postman for API testing and validation.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}