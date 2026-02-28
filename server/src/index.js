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

async function ensureRuntimeSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_follow (
        follower_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        following_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (follower_id, following_id),
        CHECK (follower_id <> following_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_follow_following
      ON user_follow(following_id, created_at DESC)
    `);
  } finally {
    client.release();
  }
}

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

function normalizeSection(section) {
  return String(section || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTags(input) {
  const values = Array.isArray(input)
    ? input
    : String(input || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  return [...new Set(values
    .map((value) => String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9+#.\- ]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, ''))
    .filter(Boolean)
  )].slice(0, 8);
}

async function attachTags(client, postId, tags) {
  await client.query(`DELETE FROM post_tag WHERE post_id = $1`, [postId]);
  for (const tagName of tags) {
    const tagRow = await client.query(
      `INSERT INTO tag (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [tagName]
    );
    await client.query(
      `INSERT INTO post_tag (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [postId, tagRow.rows[0].id]
    );
  }
}

async function getPostsByAuthor(client, userId) {
  const result = await client.query(
    `SELECT p.id, p.author_id, p.section, p.title, p.content_markdown, p.created_at, u.username AS author_name,
            COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
     FROM post p
     JOIN app_user u ON u.id = p.author_id
     LEFT JOIN post_tag pt ON pt.post_id = p.id
     LEFT JOIN tag t ON t.id = pt.tag_id
     WHERE p.is_published = TRUE AND p.author_id = $1
     GROUP BY p.id, u.username
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content_markdown,
    createdAt: new Date(row.created_at).getTime(),
    authorId: row.author_id,
    authorName: row.author_name,
    section: row.section || 'sde-general',
    tags: row.tags || []
  }));
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

app.patch('/api/account/profile', authRequired, async (req, res) => {
  const { name } = req.body || {};
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    return res.status(400).json({ message: 'Display name is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE app_user
       SET username = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, username`,
      [cleanName, req.user.sub]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = result.rows[0];
    const token = signUser(user);
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.username }
    });
  } catch (error) {
    if (String(error.code) === '23505') {
      return res.status(409).json({ message: 'That display name is already taken.' });
    }
    return res.status(500).json({ message: 'Failed to update profile.' });
  } finally {
    client.release();
  }
});

app.patch('/api/account/password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const cleanCurrentPassword = String(currentPassword || '');
  const cleanNewPassword = String(newPassword || '');
  if (!cleanCurrentPassword) {
    return res.status(400).json({ message: 'Current password is required.' });
  }
  if (!cleanNewPassword) {
    return res.status(400).json({ message: 'New password is required.' });
  }
  if (cleanNewPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, password_hash FROM app_user WHERE id = $1`,
      [req.user.sub]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const passOk = await bcrypt.compare(cleanCurrentPassword, result.rows[0].password_hash);
    if (!passOk) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const nextHash = await bcrypt.hash(cleanNewPassword, 10);
    await client.query(
      `UPDATE app_user
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [nextHash, req.user.sub]
    );
    return res.json({ ok: true });
  } finally {
    client.release();
  }
});

app.delete('/api/account', authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    const deleted = await client.query(
      `DELETE FROM app_user WHERE id = $1 RETURNING id`,
      [req.user.sub]
    );
    if (!deleted.rows[0]) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json({ ok: true });
  } finally {
    client.release();
  }
});

app.get('/api/account/following', authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    const [usersResult, postsResult] = await Promise.all([
      client.query(
        `SELECT u.id, u.username, u.bio,
                COALESCE(followers.count, 0) AS follower_count,
                COALESCE(following.count, 0) AS following_count
         FROM user_follow uf
         JOIN app_user u ON u.id = uf.following_id
         LEFT JOIN (
           SELECT following_id, COUNT(*)::int AS count
           FROM user_follow
           GROUP BY following_id
         ) followers ON followers.following_id = u.id
         LEFT JOIN (
           SELECT follower_id, COUNT(*)::int AS count
           FROM user_follow
           GROUP BY follower_id
         ) following ON following.follower_id = u.id
         WHERE uf.follower_id = $1
         ORDER BY u.username ASC`,
        [req.user.sub]
      ),
      client.query(
        `SELECT p.id, p.author_id, p.section, p.title, p.content_markdown, p.created_at, u.username AS author_name,
                COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
         FROM user_follow uf
         JOIN post p ON p.author_id = uf.following_id
         JOIN app_user u ON u.id = p.author_id
         LEFT JOIN post_tag pt ON pt.post_id = p.id
         LEFT JOIN tag t ON t.id = pt.tag_id
         WHERE uf.follower_id = $1 AND p.is_published = TRUE
         GROUP BY p.id, u.username
         ORDER BY p.created_at DESC
         LIMIT 24`,
        [req.user.sub]
      )
    ]);

    const users = usersResult.rows.map((row) => ({
      id: row.id,
      name: row.username,
      bio: row.bio || '',
      followerCount: row.follower_count || 0,
      followingCount: row.following_count || 0
    }));

    const posts = postsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content_markdown,
      createdAt: new Date(row.created_at).getTime(),
      authorId: row.author_id,
      authorName: row.author_name,
      section: row.section || 'sde-general',
      tags: row.tags || []
    }));

    return res.json({ users, posts });
  } finally {
    client.release();
  }
});

app.get('/api/users/:userId', async (req, res) => {
  const viewerId = req.headers.authorization?.startsWith('Bearer ')
    ? (() => {
        try {
          return jwt.verify(req.headers.authorization.slice('Bearer '.length), jwtSecret).sub;
        } catch {
          return null;
        }
      })()
    : null;

  const client = await pool.connect();
  try {
    const userResult = await client.query(
      `SELECT id, username, bio, created_at FROM app_user WHERE id = $1`,
      [req.params.userId]
    );
    if (!userResult.rows[0]) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const [posts, followerCount, followingCount, followState] = await Promise.all([
      getPostsByAuthor(client, req.params.userId),
      client.query(`SELECT COUNT(*)::int AS count FROM user_follow WHERE following_id = $1`, [req.params.userId]),
      client.query(`SELECT COUNT(*)::int AS count FROM user_follow WHERE follower_id = $1`, [req.params.userId]),
      viewerId
        ? client.query(
            `SELECT 1
             FROM user_follow
             WHERE follower_id = $1 AND following_id = $2`,
            [viewerId, req.params.userId]
          )
        : Promise.resolve({ rows: [] })
    ]);

    const user = userResult.rows[0];
    return res.json({
      user: {
        id: user.id,
        name: user.username,
        bio: user.bio || '',
        createdAt: new Date(user.created_at).getTime(),
        followerCount: followerCount.rows[0]?.count || 0,
        followingCount: followingCount.rows[0]?.count || 0,
        isFollowing: Boolean(followState.rows[0]),
        isSelf: viewerId === user.id
      },
      posts
    });
  } finally {
    client.release();
  }
});

app.post('/api/users/:userId/follow', authRequired, async (req, res) => {
  if (req.user.sub === req.params.userId) {
    return res.status(400).json({ message: 'You cannot follow yourself.' });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO user_follow (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.sub, req.params.userId]
    );
    return res.json({ ok: true });
  } finally {
    client.release();
  }
});

app.delete('/api/users/:userId/follow', authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query(
      `DELETE FROM user_follow WHERE follower_id = $1 AND following_id = $2`,
      [req.user.sub, req.params.userId]
    );
    return res.json({ ok: true });
  } finally {
    client.release();
  }
});

app.get('/api/posts', async (_, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT p.id, p.author_id, p.section, p.title, p.content_markdown, p.created_at, u.username AS author_name,
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
      section: row.section || 'sde-general',
      tags: row.tags || []
    }));
    return res.json({ posts });
  } finally {
    client.release();
  }
});

app.post('/api/posts', authRequired, async (req, res) => {
  const { title, content, section, tags } = req.body || {};
  const cleanTitle = String(title || '').trim();
  const cleanContent = String(content || '').trim();
  const cleanSection = normalizeSection(section);
  const cleanTags = normalizeTags(tags);
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
  if (!cleanSection) {
    return res.status(400).json({ message: 'Post section is required.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await client.query(
      `INSERT INTO post (author_id, section, title, content_markdown, slug)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, section, title, content_markdown, created_at`,
      [req.user.sub, cleanSection, cleanTitle, cleanContent, slugify(cleanTitle)]
    );
    await attachTags(client, created.rows[0].id, cleanTags);
    await client.query('COMMIT');
    return res.status(201).json({
      post: {
        id: created.rows[0].id,
        title: created.rows[0].title,
        content: created.rows[0].content_markdown,
        createdAt: new Date(created.rows[0].created_at).getTime(),
        authorId: req.user.sub,
        authorName: req.user.name,
        section: created.rows[0].section,
        tags: cleanTags
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
  const { title, content, section, tags } = req.body || {};
  const cleanTitle = String(title || '').trim();
  const cleanContent = String(content || '').trim();
  const cleanSection = normalizeSection(section);
  const cleanTags = normalizeTags(tags);
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
  if (!cleanSection) {
    return res.status(400).json({ message: 'Post section is required.' });
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
    const updated = await client.query(
      `UPDATE post
       SET section = $1, title = $2, content_markdown = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, section, title, content_markdown, created_at`,
      [cleanSection, cleanTitle, cleanContent, req.params.postId]
    );
    await attachTags(client, req.params.postId, cleanTags);
    await client.query('COMMIT');

    return res.json({
      post: {
        id: updated.rows[0].id,
        title: updated.rows[0].title,
        content: updated.rows[0].content_markdown,
        createdAt: new Date(updated.rows[0].created_at).getTime(),
        authorId: req.user.sub,
        authorName: req.user.name,
        section: updated.rows[0].section,
        tags: cleanTags
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

ensureRuntimeSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize schema.', error);
    process.exit(1);
  });
