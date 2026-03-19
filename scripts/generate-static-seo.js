const fs = require('fs');
const http = require('http');
const https = require('https');
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
const rawApiBaseUrl = String(
  process.env.REACT_APP_API_BASE_URL ||
  process.env.API_BASE_URL ||
  ''
).trim();
const apiBaseUrl = rawApiBaseUrl ? normalizeBaseUrl(rawApiBaseUrl) : '';

const publicDir = path.resolve(__dirname, '../public');
const robotsPath = path.join(publicDir, 'robots.txt');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    client
      .get(url, (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`Request failed with status ${response.statusCode}`));
          response.resume();
          return;
        }

        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

async function getSitemapUrls() {
  const entries = [
    { loc: `${siteUrl}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${siteUrl}/forum`, changefreq: 'daily', priority: '0.9' },
    { loc: `${siteUrl}/about`, changefreq: 'monthly', priority: '0.7' }
  ];

  if (!apiBaseUrl) {
    return entries;
  }

  try {
    const payload = await fetchJson(`${apiBaseUrl}/api/posts?pageSize=all`);
    const posts = Array.isArray(payload?.posts) ? payload.posts : [];

    posts.forEach((post) => {
      if (!post?.id) {
        return;
      }

      entries.push({
        loc: `${siteUrl}/forum/post/${encodeURIComponent(post.id)}`,
        changefreq: 'weekly',
        priority: '0.8',
        lastmod: post.updatedAt || post.createdAt
      });
    });
  } catch (error) {
    console.warn(`Failed to fetch public posts for sitemap generation: ${error.message}`);
  }

  return entries;
}

const robots = [
  '# https://www.robotstxt.org/robotstxt.html',
  'User-agent: *',
  'Disallow:',
  `Sitemap: ${siteUrl}/sitemap.xml`,
  ''
].join('\n');

async function main() {
  const urls = await getSitemapUrls();
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.flatMap((entry) => {
      const lines = [
        '  <url>',
        `    <loc>${entry.loc}</loc>`
      ];

      if (entry.lastmod) {
        lines.push(`    <lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>`);
      }

      lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      lines.push(`    <priority>${entry.priority}</priority>`);
      lines.push('  </url>');
      return lines;
    }),
    '</urlset>',
    ''
  ].join('\n');

  fs.writeFileSync(robotsPath, robots);
  fs.writeFileSync(sitemapPath, sitemap);

  console.log(`Generated static SEO files for ${siteUrl}`);
}

main().catch((error) => {
  console.error('Failed to generate static SEO files.', error);
  process.exit(1);
});
