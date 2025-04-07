import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-light border-top py-3 mt-auto">
      <div className="container text-center">
        <p className="mb-1">
          &copy; {new Date().getFullYear()} Shaohua Lu. All rights reserved.
        </p>
        <p className="mb-0">
          <a href="mailto:tomlu1234567@gmail.com.com" className="text-decoration-none">Email</a> |{' '}
          <a href="https://github.com/ShaohuaLuPro" target="_blank" rel="noreferrer" className="text-decoration-none">GitHub</a> |{' '}
          <a href="https://www.linkedin.com/in/shaohualu/" target="_blank" rel="noreferrer" className="text-decoration-none">LinkedIn</a>
        </p>
      </div>
    </footer>
  );
}

