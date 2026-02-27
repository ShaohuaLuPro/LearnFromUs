const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;
const dbUrl = process.env.DATABASE_URL;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

if (!jwtSecret) {
  throw new Error('Missing JWT_SECRET in server environment.');
}
if (!dbUrl) {
  throw new Error('Missing DATABASE_URL in server environment.');
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS blocked for this origin.'));
  },
  credentials: false
}));
app.use(express.json());

function signUser(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.username },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const token = auth.slice('Bearer '.length);
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function slugify(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'post'}-${Date.now().toString(36)}`;
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '');
  if (!cleanName) {
    return res.status(400).json({ message: 'Display name is required.' });
  }
  if (!cleanEmail) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  if (!cleanPassword) {
    return res.status(400).json({ message: 'Password is required.' });
  }
  if (cleanPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }
  const client = await pool.connect();
  try {
    const normalizedEmail = cleanEmail;
    const username = cleanName;
    const hashed = await bcrypt.hash(cleanPassword, 10);
    const result = await client.query(
      `INSERT INTO app_user (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username`,
      [normalizedEmail, username, hashed]
    );
    const user = result.rows[0];
    const token = signUser(user);
    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.username }
    });
  } catch (error) {
    if (String(error.code) === '23505') {
      return res.status(409).json({ message: 'Email or username already exists.' });
    }
    return res.status(500).json({ message: 'Registration failed.' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '');
  if (!cleanEmail) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  if (!cleanPassword) {
    return res.status(400).json({ message: 'Password is required.' });
  }
  const client = await pool.connect();
  try {
    const normalizedEmail = cleanEmail;
    const result = await client.query(
      `SELECT id, email, username, password_hash FROM app_user WHERE email = $1`,
      [normalizedEmail]
    );
    if (!result.rows[0]) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const user = result.rows[0];
    const passOk = await bcrypt.compare(cleanPassword, user.password_hash);
    if (!passOk) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = signUser(user);
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.username }
    });
  } finally {
    client.release();
  }
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, email, username FROM app_user WHERE id = $1`,
      [req.user.sub]
    );
    if (!result.rows[0]) {
      return res.status(401).json({ message: 'User not found.' });
    }
    const user = result.rows[0];
    return res.json({ user: { id: user.id, email: user.email, name: user.username } });
  } finally {
    client.release();
  }
});

app.get('/api/posts', async (_, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT p.id, p.author_id, p.title, p.content_markdown, p.created_at, u.username AS author_name,
              COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
       FROM post p
       JOIN app_user u ON u.id = p.author_id
       LEFT JOIN post_tag pt ON pt.post_id = p.id
       LEFT JOIN tag t ON t.id = pt.tag_id
       WHERE p.is_published = TRUE
       GROUP BY p.id, u.username
       ORDER BY p.created_at DESC`
    );
    const posts = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content_markdown,
      createdAt: new Date(row.created_at).getTime(),
      authorId: row.author_id,
      authorName: row.author_name,
      tag: row.tags[0] || 'discussion'
    }));
    return res.json({ posts });
  } finally {
    client.release();
  }
});

app.post('/api/posts', authRequired, async (req, res) => {
  const { title, content, tag } = req.body || {};
  const cleanTitle = String(title || '').trim();
  const cleanContent = String(content || '').trim();
  const cleanTag = String(tag || '').trim();
  if (!cleanTitle) {
    return res.status(400).json({ message: 'Post title is required.' });
  }
  if (cleanTitle.length < 4) {
    return res.status(400).json({ message: 'Post title must be at least 4 characters.' });
  }
  if (!cleanContent) {
    return res.status(400).json({ message: 'Post content is required.' });
  }
  if (cleanContent.length < 10) {
    return res.status(400).json({ message: 'Post content must be at least 10 characters.' });
  }
  if (!cleanTag) {
    return res.status(400).json({ message: 'Post tag is required.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const normalizedTag = cleanTag.toLowerCase().replace(/\s+/g, '-');
    const tagRow = await client.query(
      `INSERT INTO tag (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [normalizedTag]
    );
    const created = await client.query(
      `INSERT INTO post (author_id, title, content_markdown, slug)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, content_markdown, created_at`,
      [req.user.sub, cleanTitle, cleanContent, slugify(cleanTitle)]
    );
    await client.query(
      `INSERT INTO post_tag (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [created.rows[0].id, tagRow.rows[0].id]
    );
    await client.query('COMMIT');
    return res.status(201).json({
      post: {
        id: created.rows[0].id,
        title: created.rows[0].title,
        content: created.rows[0].content_markdown,
        createdAt: new Date(created.rows[0].created_at).getTime(),
        authorId: req.user.sub,
        authorName: req.user.name,
        tag: normalizedTag
      }
    });
  } catch {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Failed to create post.' });
  } finally {
    client.release();
  }
});

app.put('/api/posts/:postId', authRequired, async (req, res) => {
  const { title, content, tag } = req.body || {};
  const cleanTitle = String(title || '').trim();
  const cleanContent = String(content || '').trim();
  const cleanTag = String(tag || '').trim();
  if (!cleanTitle) {
    return res.status(400).json({ message: 'Post title is required.' });
  }
  if (cleanTitle.length < 4) {
    return res.status(400).json({ message: 'Post title must be at least 4 characters.' });
  }
  if (!cleanContent) {
    return res.status(400).json({ message: 'Post content is required.' });
  }
  if (cleanContent.length < 10) {
    return res.status(400).json({ message: 'Post content must be at least 10 characters.' });
  }
  if (!cleanTag) {
    return res.status(400).json({ message: 'Post tag is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id, author_id, created_at FROM post WHERE id = $1`,
      [req.params.postId]
    );
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Post not found.' });
    }
    if (existing.rows[0].author_id !== req.user.sub) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'You can only edit your own posts.' });
    }

    const normalizedTag = cleanTag.toLowerCase().replace(/\s+/g, '-');
    const tagRow = await client.query(
      `INSERT INTO tag (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [normalizedTag]
    );

    const updated = await client.query(
      `UPDATE post
       SET title = $1, content_markdown = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, title, content_markdown, created_at`,
      [cleanTitle, cleanContent, req.params.postId]
    );

    await client.query(`DELETE FROM post_tag WHERE post_id = $1`, [req.params.postId]);
    await client.query(
      `INSERT INTO post_tag (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.postId, tagRow.rows[0].id]
    );
    await client.query('COMMIT');

    return res.json({
      post: {
        id: updated.rows[0].id,
        title: updated.rows[0].title,
        content: updated.rows[0].content_markdown,
        createdAt: new Date(updated.rows[0].created_at).getTime(),
        authorId: req.user.sub,
        authorName: req.user.name,
        tag: normalizedTag
      }
    });
  } catch {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Failed to update post.' });
  } finally {
    client.release();
  }
});

app.delete('/api/posts/:postId', authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, author_id FROM post WHERE id = $1`,
      [req.params.postId]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Post not found.' });
    }
    if (existing.rows[0].author_id !== req.user.sub) {
      return res.status(403).json({ message: 'You can only delete your own posts.' });
    }
    await client.query(`DELETE FROM post WHERE id = $1`, [req.params.postId]);
    return res.json({ ok: true });
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
