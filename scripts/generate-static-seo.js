const fs = require('fs');
const path = require('path');

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return 'http://localhost:3000';
  }
  return trimmed.replace(/\/+$/, '');
}

const siteUrl = normalizeBaseUrl(
  process.env.REACT_APP_SITE_URL ||
  process.env.SITE_URL
);

const publicDir = path.resolve(__dirname, '../public');
const robotsPath = path.join(publicDir, 'robots.txt');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

const robots = [
  '# https://www.robotstxt.org/robotstxt.html',
  'User-agent: *',
  'Disallow:',
  `Sitemap: ${siteUrl}/sitemap.xml`,
  ''
].join('\n');

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  '  <url>',
  `    <loc>${siteUrl}/</loc>`,
  '    <changefreq>daily</changefreq>',
  '    <priority>1.0</priority>',
  '  </url>',
  '</urlset>',
  ''
].join('\n');

fs.writeFileSync(robotsPath, robots);
fs.writeFileSync(sitemapPath, sitemap);

console.log(`Generated static SEO files for ${siteUrl}`);
