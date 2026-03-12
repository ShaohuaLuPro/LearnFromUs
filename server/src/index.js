const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const duckdb = require('duckdb');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const { createActivityStore } = require('./lib/activity-store');
const { createHybridRateLimitStore, createRateLimitMiddleware } = require('./lib/rate-limit');
const { listPublicPosts, getPublicPostById } = require('./lib/post-queries');
const { runMigrations } = require('./lib/run-migrations');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;
const passwordResetSecret = process.env.PASSWORD_RESET_SECRET || jwtSecret;
const passwordResetExpiresIn = process.env.PASSWORD_RESET_EXPIRES_IN || '1h';
const dbUrl = process.env.DATABASE_URL;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const adminEmails = new Set(
  String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);
const passwordResetBaseUrl = process.env.PASSWORD_RESET_BASE_URL || `${allowedOrigins[0] || 'http://localhost:3000'}/#/login`;
const smtpHost = String(process.env.SMTP_HOST || '').trim();
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true';
const smtpUser = String(process.env.SMTP_USER || '').trim();
const smtpPass = String(process.env.SMTP_PASS || '').trim();
const smtpFrom = String(process.env.SMTP_FROM || smtpUser).trim();
const mongoUri = String(process.env.MONGODB_URI || '').trim();
const mongoDbName = String(process.env.MONGODB_DB_NAME || 'learnfromus').trim();
const duckDbPath = String(process.env.DUCKDB_PATH || path.resolve(__dirname, '../data/learnfromus-analytics.duckdb')).trim();

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
let duckDb = null;
let duckDbReady = null;
const activityStore = createActivityStore({ mongoUri, mongoDbName });
const rateLimitStore = createHybridRateLimitStore();
const mailTransport = smtpHost && smtpFrom
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser || smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
    })
  : null;

const authRateLimit = createRateLimitMiddleware(rateLimitStore, {
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
  keyPrefix: 'auth'
});
const passwordResetRateLimit = createRateLimitMiddleware(rateLimitStore, {
  windowMs: 30 * 60 * 1000,
  maxRequests: 6,
  keyPrefix: 'password-reset'
});
const agentRateLimit = createRateLimitMiddleware(rateLimitStore, {
  windowMs: 5 * 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'agent',
  keyResolver: (req) => req.user?.sub || req.ip || 'unknown'
});
const analyticsRateLimit = createRateLimitMiddleware(rateLimitStore, {
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'analytics',
  keyResolver: (req) => req.user?.sub || req.ip || 'unknown'
});

async function ensureMongoCollections() {
  const connected = await activityStore.connect();
  if (!connected) {
    return;
  }
  await rateLimitStore.configureMongoCollection(activityStore.getRateLimitCollection());
}

async function ensureDuckDbReady() {
  await fs.mkdir(path.dirname(duckDbPath), { recursive: true });
  if (!duckDbReady) {
    duckDbReady = new Promise((resolve, reject) => {
      duckDb = new duckdb.Database(duckDbPath, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(duckDb);
      });
    });
  }
  await duckDbReady;
  await duckQuery('CREATE TABLE IF NOT EXISTS analytics_runs (ran_at TIMESTAMP, source TEXT)');
  await duckQuery(`
    CREATE TABLE IF NOT EXISTS daily_author_leaderboard (
      snapshot_date DATE,
      rank INTEGER,
      author_id VARCHAR,
      author_name VARCHAR,
      author_email VARCHAR,
      post_count INTEGER,
      moderated_count INTEGER,
      score DOUBLE
    )
  `);
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
    { sub: user.id, email: user.email, name: user.username, isAdmin: isAdminUser(user) },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

function isAdminUser(user) {
  return Boolean(user?.email && adminEmails.has(String(user.email).trim().toLowerCase()));
}

function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const token = auth.slice('Bearer '.length);
    req.user = jwt.verify(token, jwtSecret);
    req.user.isAdmin = isAdminUser(req.user);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function adminRequired(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  return next();
}

function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    const token = auth.slice('Bearer '.length);
    req.user = jwt.verify(token, jwtSecret);
    req.user.isAdmin = isAdminUser(req.user);
  } catch {
    req.user = null;
  }
  return next();
}

function issuePasswordResetToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, purpose: 'password-reset' },
    `${passwordResetSecret}:${user.password_hash}`,
    { expiresIn: passwordResetExpiresIn }
  );
}

function buildPasswordResetUrl(token) {
  const joiner = passwordResetBaseUrl.includes('?') ? '&' : '?';
  return `${passwordResetBaseUrl}${joiner}resetToken=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!mailTransport) {
    return false;
  }

  await mailTransport.sendMail({
    from: smtpFrom,
    to,
    subject: 'Reset your LearnFromUs password',
    text: `Hi ${name || 'there'},\n\nUse this link to reset your password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hi ${name || 'there'},</p><p>Use this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`
  });

  return true;
}

async function recordActivity(type, payload = {}) {
  await activityStore.recordActivity(type, payload);
}

function getActivityCollection() {
  return activityStore.getActivityCollection();
}

function duckQuery(sql) {
  return new Promise((resolve, reject) => {
    if (!duckDb) {
      reject(new Error('DuckDB is not initialized.'));
      return;
    }
    Promise.resolve(duckDbReady)
      .then(() => {
        duckDb.all(sql, (error, rows) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(rows);
        });
      })
      .catch(reject);
  });
}

function escapeSqlString(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function sqlPath(filePath) {
  return escapeSqlString(filePath.replace(/\\/g, '/'));
}

function normalizeDuckValue(value) {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function normalizeDuckRows(rows) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeDuckValue(value)])
  ));
}

async function createDuckSnapshotTable(tableName, filePath, emptySchemaSql, hasRows) {
  if (!hasRows) {
    await duckQuery(`
      CREATE OR REPLACE TABLE ${tableName} AS
      ${emptySchemaSql}
    `);
    return;
  }

  await duckQuery(`
    CREATE OR REPLACE TABLE ${tableName} AS
    SELECT * FROM read_json_auto('${sqlPath(filePath)}')
  `);
}

function normalizeAnalyticsTag(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+#.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseAnalyticsFilters(input = {}) {
  const rawDays = Number(input.days);
  const days = Number.isFinite(rawDays)
    ? Math.min(Math.max(Math.trunc(rawDays), 7), 365)
    : 30;
  const section = normalizeSection(input.section || '');
  const tag = normalizeAnalyticsTag(input.tag || '');
  return {
    days,
    section: section || '',
    tag: tag || ''
  };
}

function buildPostsWhereClause(filters) {
  const clauses = [
    `CAST(created_at AS TIMESTAMP) >= NOW() - INTERVAL '${filters.days} days'`
  ];
  if (filters.section) {
    clauses.push(`section = '${escapeSqlString(filters.section)}'`);
  }
  if (filters.tag) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM tags_snapshot ts
      WHERE ts.post_id = posts_snapshot.id
        AND ts.tag_name = '${escapeSqlString(filters.tag)}'
    )`);
  }
  return clauses.join('\n          AND ');
}

function buildActivityWhereClause(filters) {
  return `CAST(createdAt AS TIMESTAMP) >= NOW() - INTERVAL '${filters.days} days'`;
}

async function refreshDuckDbSnapshots() {
  const [postRows, userRows, tagRows] = await Promise.all([
    pool.query(
      `SELECT p.id, p.author_id, p.section, p.title, p.created_at, p.updated_at,
              p.deleted_by_admin_at, p.deleted_reason, p.appeal_requested_at, p.restored_at,
              u.username AS author_name, u.email AS author_email
       FROM post p
       JOIN app_user u ON u.id = p.author_id`
    ),
    pool.query(
      `SELECT id, email, username, created_at
       FROM app_user`
    ),
    pool.query(
      `SELECT pt.post_id, t.name AS tag_name
       FROM post_tag pt
       JOIN tag t ON t.id = pt.tag_id`
    )
  ]);

  const activityCollection = getActivityCollection();
  const activityRows = activityCollection
    ? await activityCollection.find({})
      .sort({ createdAt: -1 })
      .limit(5000)
      .project({ _id: 0 })
      .toArray()
    : [];

  const snapshotDir = path.resolve(__dirname, '../data/duckdb-snapshots');
  await fs.mkdir(snapshotDir, { recursive: true });
  const postsFile = path.join(snapshotDir, 'posts.json');
  const usersFile = path.join(snapshotDir, 'users.json');
  const activityFile = path.join(snapshotDir, 'activity.json');
  const tagsFile = path.join(snapshotDir, 'tags.json');
  await Promise.all([
    fs.writeFile(postsFile, JSON.stringify(postRows.rows, null, 2)),
    fs.writeFile(usersFile, JSON.stringify(userRows.rows, null, 2)),
    fs.writeFile(activityFile, JSON.stringify(activityRows, null, 2)),
    fs.writeFile(tagsFile, JSON.stringify(tagRows.rows, null, 2))
  ]);

  await createDuckSnapshotTable(
    'posts_snapshot',
    postsFile,
    `SELECT
       CAST(NULL AS VARCHAR) AS id,
       CAST(NULL AS VARCHAR) AS author_id,
       CAST(NULL AS VARCHAR) AS section,
       CAST(NULL AS VARCHAR) AS title,
       CAST(NULL AS TIMESTAMP) AS created_at,
       CAST(NULL AS TIMESTAMP) AS updated_at,
       CAST(NULL AS TIMESTAMP) AS deleted_by_admin_at,
       CAST(NULL AS VARCHAR) AS deleted_reason,
       CAST(NULL AS TIMESTAMP) AS appeal_requested_at,
       CAST(NULL AS TIMESTAMP) AS restored_at,
       CAST(NULL AS VARCHAR) AS author_name,
       CAST(NULL AS VARCHAR) AS author_email
     WHERE FALSE`,
    postRows.rows.length > 0
  );
  await createDuckSnapshotTable(
    'users_snapshot',
    usersFile,
    `SELECT
       CAST(NULL AS VARCHAR) AS id,
       CAST(NULL AS VARCHAR) AS email,
       CAST(NULL AS VARCHAR) AS username,
       CAST(NULL AS TIMESTAMP) AS created_at
     WHERE FALSE`,
    userRows.rows.length > 0
  );
  await createDuckSnapshotTable(
    'activity_snapshot',
    activityFile,
    `SELECT
       CAST(NULL AS VARCHAR) AS type,
       CAST(NULL AS VARCHAR) AS userId,
       CAST(NULL AS TIMESTAMP) AS createdAt
     WHERE FALSE`,
    activityRows.length > 0
  );
  await createDuckSnapshotTable(
    'tags_snapshot',
    tagsFile,
    `SELECT
       CAST(NULL AS VARCHAR) AS post_id,
       CAST(NULL AS VARCHAR) AS tag_name
     WHERE FALSE`,
    tagRows.rows.length > 0
  );
  await duckQuery(`
    INSERT INTO analytics_runs
    VALUES (NOW(), 'postgres+mongo')
  `);
  await duckQuery(`
    DELETE FROM daily_author_leaderboard
    WHERE snapshot_date = CURRENT_DATE
  `);
  await duckQuery(`
    INSERT INTO daily_author_leaderboard
    SELECT
      CURRENT_DATE AS snapshot_date,
      ROW_NUMBER() OVER (ORDER BY score DESC, author_name ASC) AS rank,
      author_id,
      author_name,
      author_email,
      post_count,
      moderated_count,
      score
    FROM (
      SELECT
        author_id,
        author_name,
        author_email,
        COUNT(*) AS post_count,
        SUM(CASE WHEN deleted_by_admin_at IS NOT NULL THEN 1 ELSE 0 END) AS moderated_count,
        COUNT(*) * 10 - SUM(CASE WHEN deleted_by_admin_at IS NOT NULL THEN 1 ELSE 0 END) * 3 AS score
      FROM posts_snapshot
      GROUP BY 1, 2, 3
    ) ranked_authors
    QUALIFY ROW_NUMBER() OVER (ORDER BY score DESC, author_name ASC) <= 10
  `);
}

const parquetDatasetDefinitions = {
  posts: {
    fileName: 'posts_snapshot.parquet',
    sql: 'COPY posts_snapshot TO ? (FORMAT PARQUET)'
  },
  users: {
    fileName: 'users_snapshot.parquet',
    sql: 'COPY users_snapshot TO ? (FORMAT PARQUET)'
  },
  activity: {
    fileName: 'activity_snapshot.parquet',
    sql: 'COPY activity_snapshot TO ? (FORMAT PARQUET)'
  },
  tags: {
    fileName: 'tags_snapshot.parquet',
    sql: 'COPY tags_snapshot TO ? (FORMAT PARQUET)'
  },
  leaderboard: {
    fileName: 'daily_author_leaderboard.parquet',
    sql: 'COPY daily_author_leaderboard TO ? (FORMAT PARQUET)'
  },
  sections: {
    fileName: 'sections_summary.parquet',
    sql: `
      COPY (
        SELECT
          COALESCE(section, 'unknown') AS section,
          COUNT(*) AS count,
          SUM(CASE WHEN deleted_by_admin_at IS NOT NULL THEN 1 ELSE 0 END) AS moderated_count
        FROM posts_snapshot
        GROUP BY 1
        ORDER BY count DESC, section ASC
      ) TO ? (FORMAT PARQUET)
    `
  },
  authors: {
    fileName: 'top_authors.parquet',
    sql: `
      COPY (
        SELECT
          author_name,
          author_email,
          COUNT(*) AS post_count,
          SUM(CASE WHEN deleted_by_admin_at IS NOT NULL THEN 1 ELSE 0 END) AS moderated_count
        FROM posts_snapshot
        GROUP BY 1, 2
        ORDER BY post_count DESC, author_name ASC
        LIMIT 10
      ) TO ? (FORMAT PARQUET)
    `
  },
  activity_types: {
    fileName: 'activity_types.parquet',
    sql: `
      COPY (
        SELECT
          COALESCE(type, 'unknown') AS type,
          COUNT(*) AS count
        FROM activity_snapshot
        GROUP BY 1
        ORDER BY count DESC, type ASC
        LIMIT 15
      ) TO ? (FORMAT PARQUET)
    `
  },
  top_tags: {
    fileName: 'top_tags.parquet',
    sql: `
      COPY (
        SELECT
          tag_name,
          COUNT(*) AS post_count,
          COUNT(DISTINCT ts.post_id) FILTER (
            WHERE ps.deleted_by_admin_at IS NULL
          ) AS live_post_count,
          COUNT(DISTINCT ts.post_id) FILTER (
            WHERE ps.deleted_by_admin_at IS NOT NULL
          ) AS moderated_post_count
        FROM tags_snapshot ts
        JOIN posts_snapshot ps ON ps.id = ts.post_id
        GROUP BY 1
        ORDER BY post_count DESC, tag_name ASC
        LIMIT 15
      ) TO ? (FORMAT PARQUET)
    `
  },
  activity_trend: {
    fileName: 'activity_trend.parquet',
    sql: `
      COPY (
        WITH event_days AS (
          SELECT
            CAST(createdAt AS DATE) AS day,
            COUNT(*) AS events,
            COUNT(DISTINCT userId) FILTER (WHERE userId IS NOT NULL) AS active_users
          FROM activity_snapshot
          GROUP BY 1
        )
        SELECT *
        FROM event_days
        ORDER BY day DESC
        LIMIT 14
      ) TO ? (FORMAT PARQUET)
    `
  }
};

function duckExec(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!duckDb) {
      reject(new Error('DuckDB is not initialized.'));
      return;
    }
    Promise.resolve(duckDbReady)
      .then(() => {
        duckDb.run(sql, params, (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
      .catch(reject);
  });
}

async function buildDuckDbOverview(rawFilters = {}) {
  try {
    const filters = parseAnalyticsFilters(rawFilters);
    await refreshDuckDbSnapshots();
    const postsWhereClause = buildPostsWhereClause(filters);
    const activityWhereClause = buildActivityWhereClause(filters);

    const [
      overviewRows,
      sectionRows,
      authorRows,
      activityTypeRows,
      moderationRows,
      tagRowsAgg,
      activityTrendRows,
      dailyLeaderboardRows,
      availableSectionRows,
      availableTagRows
    ] = await Promise.all([
      duckQuery(`
        SELECT
          (SELECT COUNT(*) FROM users_snapshot) AS total_users,
          (SELECT COUNT(*) FROM posts_snapshot WHERE ${postsWhereClause}) AS total_posts,
          (SELECT COUNT(*) FROM posts_snapshot WHERE ${postsWhereClause} AND deleted_by_admin_at IS NULL) AS public_posts,
          (SELECT COUNT(*) FROM posts_snapshot WHERE ${postsWhereClause} AND deleted_by_admin_at IS NOT NULL) AS moderated_posts,
          (SELECT COUNT(*) FROM posts_snapshot WHERE ${postsWhereClause} AND appeal_requested_at IS NOT NULL) AS appealed_posts,
          (SELECT COUNT(*) FROM activity_snapshot WHERE ${activityWhereClause}) AS tracked_events
      `),
      duckQuery(`
        SELECT
          COALESCE(section, 'unknown') AS section,
          COUNT(*) AS count,
          SUM(CASE WHEN deleted_by_admin_at IS NOT NULL THEN 1 ELSE 0 END) AS moderated_count
        FROM posts_snapshot
        WHERE ${postsWhereClause}
        GROUP BY 1
        ORDER BY count DESC, section ASC
      `),
      duckQuery(`
        SELECT
          author_name,
          author_email,
          COUNT(*) AS post_count,
          SUM(CASE WHEN deleted_by_admin_at IS NOT NULL THEN 1 ELSE 0 END) AS moderated_count
        FROM posts_snapshot
        WHERE ${postsWhereClause}
        GROUP BY 1, 2
        ORDER BY post_count DESC, author_name ASC
        LIMIT 10
      `),
      duckQuery(`
        SELECT
          COALESCE(type, 'unknown') AS type,
          COUNT(*) AS count
        FROM activity_snapshot
        WHERE ${activityWhereClause}
        GROUP BY 1
        ORDER BY count DESC, type ASC
        LIMIT 15
      `),
      duckQuery(`
        SELECT
          title,
          author_name,
          deleted_reason,
          deleted_by_admin_at,
          appeal_requested_at
        FROM posts_snapshot
        WHERE ${postsWhereClause}
          AND deleted_by_admin_at IS NOT NULL
        ORDER BY deleted_by_admin_at DESC
        LIMIT 10
      `),
      duckQuery(`
        SELECT
          tag_name,
          COUNT(*) AS post_count,
          COUNT(DISTINCT ts.post_id) FILTER (
            WHERE ps.deleted_by_admin_at IS NULL
          ) AS live_post_count,
          COUNT(DISTINCT ts.post_id) FILTER (
            WHERE ps.deleted_by_admin_at IS NOT NULL
          ) AS moderated_post_count
        FROM tags_snapshot ts
        JOIN posts_snapshot ps ON ps.id = ts.post_id
        WHERE ${postsWhereClause}
        GROUP BY 1
        ORDER BY post_count DESC, tag_name ASC
        LIMIT 15
      `),
      duckQuery(`
        WITH event_days AS (
          SELECT
            CAST(createdAt AS DATE) AS day,
            COUNT(*) AS events,
            COUNT(DISTINCT userId) FILTER (WHERE userId IS NOT NULL) AS active_users
          FROM activity_snapshot
          WHERE ${activityWhereClause}
          GROUP BY 1
        )
        SELECT *
        FROM event_days
        ORDER BY day DESC
        LIMIT ${Math.min(filters.days, 30)}
      `),
      duckQuery(`
        SELECT
          author_name,
          post_count,
          moderated_count,
          score
        FROM (
          SELECT
            author_name,
            author_email,
            COUNT(*) AS post_count,
            SUM(CASE WHEN deleted_by_admin_at IS NOT NULL THEN 1 ELSE 0 END) AS moderated_count,
            COUNT(*) * 10 - SUM(CASE WHEN deleted_by_admin_at IS NOT NULL THEN 1 ELSE 0 END) * 3 AS score
          FROM posts_snapshot
          WHERE ${postsWhereClause}
          GROUP BY 1, 2
        ) ranked_authors
        ORDER BY score DESC, author_name ASC
        LIMIT 10
      `),
      duckQuery(`
        SELECT DISTINCT section
        FROM posts_snapshot
        WHERE section IS NOT NULL AND TRIM(section) <> ''
        ORDER BY section ASC
      `),
      duckQuery(`
        SELECT
          tag_name,
          COUNT(*) AS post_count
        FROM tags_snapshot
        GROUP BY 1
        ORDER BY post_count DESC, tag_name ASC
        LIMIT 50
      `)
    ]);

    return {
      engine: 'duckdb',
      databasePath: duckDbPath,
      filters,
      overview: normalizeDuckRows(overviewRows)[0] || {},
      sections: normalizeDuckRows(sectionRows),
      authors: normalizeDuckRows(authorRows),
      activityTypes: normalizeDuckRows(activityTypeRows),
      moderation: normalizeDuckRows(moderationRows),
      topTags: normalizeDuckRows(tagRowsAgg),
      activityTrend: normalizeDuckRows(activityTrendRows).reverse(),
      dailyLeaderboard: normalizeDuckRows(dailyLeaderboardRows).map((row, index) => ({
        ...row,
        rank: index + 1
      })),
      availableFilters: {
        sections: normalizeDuckRows(availableSectionRows).map((row) => row.section).filter(Boolean),
        tags: normalizeDuckRows(availableTagRows).map((row) => row.tag_name).filter(Boolean)
      }
    };
  } finally {
    // no-op: queries use pool-level helpers, but keep the try/finally structure intact
  }
}

async function purgeExpiredModeratedPosts() {
  const client = await pool.connect();
  try {
    const expired = await client.query(
      `DELETE FROM post
       WHERE deleted_by_admin_at IS NOT NULL
         AND appeal_requested_at IS NULL
         AND deleted_by_admin_at <= NOW() - INTERVAL '15 days'
       RETURNING id, author_id`
    );
    for (const row of expired.rows) {
      await recordActivity('post.permanently_deleted_after_moderation', {
        userId: row.author_id,
        postId: row.id
      });
    }
    return expired.rowCount || 0;
  } finally {
    client.release();
  }
}

function millisecondsUntilNextUtcMidnight() {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    5,
    0,
    0
  ));
  return next.getTime() - now.getTime();
}

function scheduleDailyAnalyticsRefresh() {
  const delay = millisecondsUntilNextUtcMidnight();
  setTimeout(async () => {
    try {
      await buildDuckDbOverview();
      console.log('DuckDB daily leaderboard refreshed.');
    } catch (error) {
      console.error('Failed to refresh DuckDB daily leaderboard.', error);
    } finally {
      scheduleDailyAnalyticsRefresh();
    }
  }, delay);
}

async function exportParquetDataset(datasetKey) {
  const definition = parquetDatasetDefinitions[datasetKey];
  if (!definition) {
    throw new Error('Unsupported parquet dataset.');
  }

  await buildDuckDbOverview();
  const exportDir = path.resolve(__dirname, '../data/parquet-exports');
  await fs.mkdir(exportDir, { recursive: true });
  const filePath = path.join(exportDir, definition.fileName);
  await duckExec(definition.sql, [filePath]);
  return {
    dataset: datasetKey,
    filePath,
    fileName: definition.fileName
  };
}

function listParquetDatasets() {
  return Object.entries(parquetDatasetDefinitions).map(([key, definition]) => ({
    key,
    fileName: definition.fileName
  }));
}

function detectAgentIntent(message) {
  const text = String(message || '').toLowerCase();
  if (/(publish|post this|submit this|create post from|send this)/.test(text)) {
    return 'publish';
  }
  if (/(draft|write|generate|compose|help me post|create a post)/.test(text)) {
    return 'draft';
  }
  if (/(hot|popular|top author|top authors|trending|best posts|best authors)/.test(text)) {
    return 'trending';
  }
  if (/(search|find|look for|related post|related posts|posts about|query)/.test(text)) {
    return 'search';
  }
  return 'help';
}

function extractQuotedValue(message, key) {
  const regex = new RegExp(`${key}\\s*[:=]\\s*["']([^"']+)["']`, 'i');
  const match = regex.exec(message);
  return match ? match[1].trim() : '';
}

function pickSectionFromMessage(message) {
  const normalized = normalizeSection(message);
  const candidates = [
    'frontend',
    'backend',
    'algorithms',
    'system-design',
    'ui-ux',
    'devops-cloud',
    'mobile',
    'testing-qa',
    'security',
    'sde-general',
    'ai-llm',
    'mle',
    'deep-learning',
    'data-engineering',
    'statistics',
    'analytics',
    'experimentation',
    'visualization',
    'ds-general',
    'announcements',
    'system-update'
  ];
  return candidates.find((section) => normalized.includes(section)) || '';
}

function extractTagsFromMessage(message) {
  const hashTags = String(message || '').match(/#[a-z0-9.+-]+/gi) || [];
  return normalizeTags(hashTags.map((tag) => tag.replace(/^#/, '')));
}

function buildDraftFromMessage(message) {
  const explicitTitle = extractQuotedValue(message, 'title');
  const explicitSection = extractQuotedValue(message, 'section') || pickSectionFromMessage(message);
  const explicitTopic = extractQuotedValue(message, 'topic') || String(message || '')
    .replace(/^(write|generate|draft|compose|help me post|create a post)\s*/i, '')
    .trim();
  const cleanTopic = explicitTopic || 'a practical engineering lesson';
  const title = explicitTitle || `Practical notes on ${cleanTopic.charAt(0).toUpperCase()}${cleanTopic.slice(1)}`;
  const section = explicitSection || 'sde-general';
  const tags = extractTagsFromMessage(message).slice(0, 4);
  const outlineBullets = [
    `## Problem`,
    `What specific issue or learning moment did you run into with ${cleanTopic}?`,
    '',
    `## Approach`,
    `Explain the setup, the tradeoffs you considered, and the implementation path you chose.`,
    '',
    `## What worked`,
    `Share the concrete outcome, code pattern, or product decision that proved useful.`,
    '',
    `## What I would improve next`,
    `Call out limitations, follow-up ideas, or what you would do differently.`
  ];
  return {
    title,
    section,
    tags,
    content: outlineBullets.join('\n'),
    summary: `Drafted a post outline about ${cleanTopic}.`
  };
}

async function searchPublicPostsForAgent(message, limit = 5) {
  const client = await pool.connect();
  try {
    const rawQuery = String(message || '')
      .replace(/^(search|find|look for|posts about|related posts?|query)\s*/i, '')
      .trim();
    const query = rawQuery || String(message || '').trim();
    const like = `%${query}%`;
    const result = await client.query(
      `SELECT p.id, p.author_id, p.section, p.title, p.content_markdown, p.created_at, p.updated_at,
              p.deleted_by_admin_at, p.deleted_by_admin_id, p.deleted_reason, p.appeal_requested_at, p.appeal_note, p.restored_at,
              u.username AS author_name, u.email AS author_email,
              COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
       FROM post p
       JOIN app_user u ON u.id = p.author_id
       LEFT JOIN post_tag pt ON pt.post_id = p.id
       LEFT JOIN tag t ON t.id = pt.tag_id
       WHERE p.is_published = TRUE
         AND p.deleted_by_admin_at IS NULL
         AND (
           p.title ILIKE $1
           OR p.content_markdown ILIKE $1
           OR p.section ILIKE $1
           OR EXISTS (
             SELECT 1
             FROM post_tag pt2
             JOIN tag t2 ON t2.id = pt2.tag_id
             WHERE pt2.post_id = p.id
               AND t2.name ILIKE $1
           )
         )
       GROUP BY p.id, u.username, u.email
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [like, limit]
    );
    return result.rows.map(mapPostRow);
  } finally {
    client.release();
  }
}

async function getTrendingAgentSnapshot() {
  const analytics = await buildDuckDbOverview({ days: 30 });
  const hotPosts = (await searchPublicPostsForAgent('', 5)).slice(0, 5);
  return {
    posts: hotPosts,
    authors: analytics.dailyLeaderboard.slice(0, 5)
  };
}

async function runAgentCommand(message, user) {
  const intent = detectAgentIntent(message);

  if (intent === 'search') {
    const posts = await searchPublicPostsForAgent(message, 6);
    return {
      intent,
      reply: posts.length
        ? `I found ${posts.length} related posts.`
        : 'I could not find matching posts. Try a tag, section, or a more specific phrase.',
      posts,
      quickActions: ['show-trending', 'draft-post']
    };
  }

  if (intent === 'trending') {
    const snapshot = await getTrendingAgentSnapshot();
    return {
      intent,
      reply: 'Here are the most active authors and a few recent posts worth checking.',
      posts: snapshot.posts,
      authors: snapshot.authors,
      quickActions: ['search-posts', 'draft-post']
    };
  }

  if (intent === 'draft' || intent === 'publish') {
    const draft = buildDraftFromMessage(message);
    return {
      intent,
      reply: intent === 'publish'
        ? 'I prepared a publish-ready draft. Review it before posting.'
        : 'I drafted a post outline you can review, edit, or publish.',
      draft,
      quickActions: user ? ['publish-draft', 'search-posts'] : ['login-to-publish', 'search-posts']
    };
  }

  return {
    intent: 'help',
    reply: 'I can search related posts, show active authors, draft a new post, or help you publish a draft. Try: "find posts about mongodb", "show top authors", or "draft a post about password reset".',
    quickActions: ['search-posts', 'show-trending', 'draft-post']
  };
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

function mapPostRow(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content_markdown,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    authorId: row.author_id,
    authorName: row.author_name,
    authorEmail: row.author_email,
    section: row.section || 'sde-general',
    tags: row.tags || [],
    moderation: {
      isDeleted: Boolean(row.deleted_by_admin_at),
      deletedAt: row.deleted_by_admin_at ? new Date(row.deleted_by_admin_at).getTime() : null,
      deletedByAdminId: row.deleted_by_admin_id || null,
      deletedReason: row.deleted_reason || '',
      appealRequestedAt: row.appeal_requested_at ? new Date(row.appeal_requested_at).getTime() : null,
      appealNote: row.appeal_note || '',
      restoredAt: row.restored_at ? new Date(row.restored_at).getTime() : null
    }
  };
}

function mapCommentRow(row) {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorEmail: row.author_email,
    content: row.content_markdown,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null
  };
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
    `SELECT p.id, p.author_id, p.section, p.title, p.content_markdown, p.created_at, p.updated_at,
            p.deleted_by_admin_at, p.deleted_by_admin_id, p.deleted_reason, p.appeal_requested_at, p.appeal_note, p.restored_at,
            u.username AS author_name, u.email AS author_email,
            COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
     FROM post p
     JOIN app_user u ON u.id = p.author_id
     LEFT JOIN post_tag pt ON pt.post_id = p.id
     LEFT JOIN tag t ON t.id = pt.tag_id
     WHERE p.is_published = TRUE AND p.deleted_by_admin_at IS NULL AND p.author_id = $1
     GROUP BY p.id, u.username, u.email
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows.map(mapPostRow);
}

async function getCommentsByPost(client, postId) {
  const result = await client.query(
    `SELECT c.id, c.post_id, c.author_id, c.content_markdown, c.created_at, c.updated_at,
            u.username AS author_name, u.email AS author_email
     FROM comment c
     JOIN app_user u ON u.id = c.author_id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC`,
    [postId]
  );
  return result.rows.map(mapCommentRow);
}

async function getPublicPostMeta(client, postId) {
  const result = await client.query(
    `SELECT id
     FROM post
     WHERE id = $1
       AND is_published = TRUE
       AND deleted_by_admin_at IS NULL`,
    [postId]
  );
  return result.rows[0] || null;
}

function mapNetworkUserRow(row) {
  return {
    id: row.id,
    name: row.username,
    bio: row.bio || '',
    followerCount: row.follower_count || 0,
    followingCount: row.following_count || 0,
    isFollowing: Boolean(row.is_following),
    isFollowedBy: Boolean(row.is_followed_by)
  };
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', authRateLimit, async (req, res) => {
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
    await recordActivity('auth.registered', {
      userId: user.id,
      email: user.email,
      username: user.username
    });
    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.username, isAdmin: isAdminUser(user) }
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

app.post('/api/auth/login', authRateLimit, async (req, res) => {
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
      await recordActivity('auth.login_failed', {
        email: cleanEmail,
        reason: 'invalid_password'
      });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = signUser(user);
    await recordActivity('auth.logged_in', {
      userId: user.id,
      email: user.email,
      username: user.username
    });
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.username, isAdmin: isAdminUser(user) }
    });
  } finally {
    client.release();
  }
});

app.post('/api/auth/password-reset/request', passwordResetRateLimit, async (req, res) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const genericMessage = 'If that email exists, a password reset link has been generated.';
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, email, username, password_hash FROM app_user WHERE email = $1`,
      [cleanEmail]
    );

    if (!result.rows[0]) {
      await recordActivity('auth.password_reset_requested', {
        email: cleanEmail,
        knownUser: false
      });
      return res.json({ ok: true, message: genericMessage });
    }

    const user = result.rows[0];
    const token = issuePasswordResetToken(user);
    const resetUrl = buildPasswordResetUrl(token);
    const mailSent = await sendPasswordResetEmail({
      to: user.email,
      name: user.username,
      resetUrl
    });
    await recordActivity('auth.password_reset_requested', {
      userId: user.id,
      email: user.email,
      username: user.username,
      knownUser: true,
      delivery: mailSent ? 'email' : 'local_link'
    });

    return res.json({
      ok: true,
      message: mailSent ? 'Password reset email sent.' : genericMessage,
      resetUrl: mailSent ? undefined : resetUrl
    });
  } catch (error) {
    console.error('Failed to issue password reset.', error);
    return res.status(500).json({ message: 'Failed to create a reset link.' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/password-reset/confirm', passwordResetRateLimit, async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const cleanNewPassword = String(req.body?.newPassword || '');
  if (!token) {
    return res.status(400).json({ message: 'Reset token is required.' });
  }
  if (!cleanNewPassword) {
    return res.status(400).json({ message: 'New password is required.' });
  }
  if (cleanNewPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }

  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== 'object' || decoded.purpose !== 'password-reset' || !decoded.sub) {
    return res.status(400).json({ message: 'Reset link is invalid.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, password_hash FROM app_user WHERE id = $1`,
      [decoded.sub]
    );
    if (!result.rows[0]) {
      return res.status(400).json({ message: 'Reset link is invalid.' });
    }

    try {
      jwt.verify(token, `${passwordResetSecret}:${result.rows[0].password_hash}`);
    } catch {
      return res.status(400).json({ message: 'Reset link is invalid or expired.' });
    }

    const nextHash = await bcrypt.hash(cleanNewPassword, 10);
    await client.query(
      `UPDATE app_user
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [nextHash, decoded.sub]
    );
    await recordActivity('auth.password_reset_completed', {
      userId: decoded.sub
    });
    return res.json({ ok: true, message: 'Password reset complete. You can now login.' });
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
    return res.json({ user: { id: user.id, email: user.email, name: user.username, isAdmin: isAdminUser(user) } });
  } finally {
    client.release();
  }
});

app.get('/api/account/posts', authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT p.id, p.author_id, p.section, p.title, p.content_markdown, p.created_at, p.updated_at,
              p.deleted_by_admin_at, p.deleted_by_admin_id, p.deleted_reason, p.appeal_requested_at, p.appeal_note, p.restored_at,
              u.username AS author_name, u.email AS author_email,
              COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
       FROM post p
       JOIN app_user u ON u.id = p.author_id
       LEFT JOIN post_tag pt ON pt.post_id = p.id
       LEFT JOIN tag t ON t.id = pt.tag_id
       WHERE p.author_id = $1
       GROUP BY p.id, u.username, u.email
       ORDER BY p.created_at DESC`,
      [req.user.sub]
    );
    return res.json({ posts: result.rows.map(mapPostRow) });
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
    await recordActivity('account.profile_updated', {
      userId: user.id,
      username: user.username
    });
    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.username, isAdmin: isAdminUser(user) }
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
    await recordActivity('account.password_updated', {
      userId: req.user.sub
    });
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
    await recordActivity('account.deleted', {
      userId: req.user.sub
    });
    return res.json({ ok: true });
  } finally {
    client.release();
  }
});

app.get('/api/account/activity', authRequired, async (req, res) => {
  const activityCollection = getActivityCollection();
  if (!activityCollection) {
    return res.json({
      enabled: false,
      events: [],
      summary: [],
      message: 'MongoDB is not configured.'
    });
  }

  const [events, summary] = await Promise.all([
    activityCollection
      .find({ userId: req.user.sub })
      .sort({ createdAt: -1 })
      .limit(20)
      .project({ _id: 0 })
      .toArray(),
    activityCollection.aggregate([
      { $match: { userId: req.user.sub } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 12 },
      { $project: { _id: 0, type: '$_id', count: 1 } }
    ]).toArray()
  ]);

  return res.json({ enabled: true, events, summary });
});

app.get('/api/account/following', authRequired, async (req, res) => {
  const [followingResult, followersResult, postsResult] = await Promise.all([
    pool.query(
      `SELECT u.id, u.username, u.bio,
              COALESCE(followers.count, 0) AS follower_count,
              COALESCE(following.count, 0) AS following_count,
              TRUE AS is_following,
              EXISTS (
                SELECT 1
                FROM user_follow reverse_follow
                WHERE reverse_follow.follower_id = u.id
                  AND reverse_follow.following_id = $1
              ) AS is_followed_by
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
    pool.query(
      `SELECT u.id, u.username, u.bio,
              COALESCE(followers.count, 0) AS follower_count,
              COALESCE(following.count, 0) AS following_count,
              EXISTS (
                SELECT 1
                FROM user_follow follow_state
                WHERE follow_state.follower_id = $1
                  AND follow_state.following_id = u.id
              ) AS is_following,
              TRUE AS is_followed_by
       FROM user_follow uf
       JOIN app_user u ON u.id = uf.follower_id
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
       WHERE uf.following_id = $1
       ORDER BY u.username ASC`,
      [req.user.sub]
    ),
    pool.query(
      `SELECT p.id, p.author_id, p.section, p.title, p.content_markdown, p.created_at, p.updated_at,
              p.deleted_by_admin_at, p.deleted_by_admin_id, p.deleted_reason, p.appeal_requested_at, p.appeal_note, p.restored_at,
              u.username AS author_name, u.email AS author_email,
              COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
       FROM user_follow uf
       JOIN post p ON p.author_id = uf.following_id
       JOIN app_user u ON u.id = p.author_id
       LEFT JOIN post_tag pt ON pt.post_id = p.id
       LEFT JOIN tag t ON t.id = pt.tag_id
       WHERE uf.follower_id = $1 AND p.is_published = TRUE AND p.deleted_by_admin_at IS NULL
       GROUP BY p.id, u.username, u.email
       ORDER BY p.created_at DESC
       LIMIT 24`,
      [req.user.sub]
    )
  ]);

  const following = followingResult.rows.map(mapNetworkUserRow);
  const followers = followersResult.rows.map(mapNetworkUserRow);
  const posts = postsResult.rows.map(mapPostRow);

  return res.json({
    users: following,
    following,
    followers,
    posts
  });
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

  const userResult = await pool.query(
    `SELECT id, username, bio, created_at FROM app_user WHERE id = $1`,
    [req.params.userId]
  );
  if (!userResult.rows[0]) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const [posts, followerCount, followingCount, followState] = await Promise.all([
    getPostsByAuthor(pool, req.params.userId),
    pool.query(`SELECT COUNT(*)::int AS count FROM user_follow WHERE following_id = $1`, [req.params.userId]),
    pool.query(`SELECT COUNT(*)::int AS count FROM user_follow WHERE follower_id = $1`, [req.params.userId]),
    viewerId
      ? pool.query(
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
});

app.get('/api/admin/posts/moderation', authRequired, adminRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT p.id, p.author_id, p.section, p.title, p.content_markdown, p.created_at, p.updated_at,
              p.deleted_by_admin_at, p.deleted_by_admin_id, p.deleted_reason, p.appeal_requested_at, p.appeal_note, p.restored_at,
              u.username AS author_name, u.email AS author_email,
              COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
       FROM post p
       JOIN app_user u ON u.id = p.author_id
       LEFT JOIN post_tag pt ON pt.post_id = p.id
       LEFT JOIN tag t ON t.id = pt.tag_id
       WHERE p.deleted_by_admin_at IS NOT NULL
       GROUP BY p.id, u.username, u.email
       ORDER BY p.deleted_by_admin_at DESC, p.created_at DESC`
    );
    return res.json({ posts: result.rows.map(mapPostRow) });
  } finally {
    client.release();
  }
});

app.get('/api/admin/analytics/overview', authRequired, adminRequired, analyticsRateLimit, async (req, res) => {
  try {
    const analytics = await buildDuckDbOverview(req.query);
    return res.json(analytics);
  } catch (error) {
    console.error('Failed to build DuckDB analytics overview.', error);
    return res.status(500).json({ message: 'Failed to build analytics overview.' });
  }
});

app.get('/api/admin/analytics/query', authRequired, adminRequired, analyticsRateLimit, async (req, res) => {
  try {
    const analytics = await buildDuckDbOverview(req.query);
    return res.json(analytics);
  } catch (error) {
    console.error('Failed to run DuckDB analytics query.', error);
    return res.status(500).json({ message: 'Failed to run analytics query.' });
  }
});

app.get('/api/admin/analytics/parquet', authRequired, adminRequired, analyticsRateLimit, async (_, res) => {
  try {
    return res.json({ datasets: listParquetDatasets() });
  } catch (error) {
    console.error('Failed to list Parquet datasets.', error);
    return res.status(500).json({ message: 'Failed to list Parquet datasets.' });
  }
});

app.get('/api/admin/analytics/parquet/:dataset', authRequired, adminRequired, analyticsRateLimit, async (req, res) => {
  try {
    const exported = await exportParquetDataset(req.params.dataset);
    return res.download(exported.filePath, exported.fileName);
  } catch (error) {
    if (error.message === 'Unsupported parquet dataset.') {
      return res.status(404).json({ message: 'Parquet dataset not found.' });
    }
    console.error('Failed to export Parquet dataset.', error);
    return res.status(500).json({ message: 'Failed to export Parquet dataset.' });
  }
});

app.post('/api/posts/:postId/appeal', authRequired, async (req, res) => {
  const appealNote = String(req.body?.note || '').trim();
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, author_id, deleted_by_admin_at, appeal_requested_at
       FROM post
       WHERE id = $1`,
      [req.params.postId]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Post not found.' });
    }
    const post = existing.rows[0];
    if (post.author_id !== req.user.sub) {
      return res.status(403).json({ message: 'You can only appeal your own posts.' });
    }
    if (!post.deleted_by_admin_at) {
      return res.status(400).json({ message: 'This post is not under moderation.' });
    }
    if (post.appeal_requested_at) {
      return res.status(400).json({ message: 'An appeal has already been submitted for this post.' });
    }
    if (Date.now() - new Date(post.deleted_by_admin_at).getTime() > 15 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ message: 'The 15-day appeal window has expired.' });
    }

    await client.query(
      `UPDATE post
       SET appeal_requested_at = NOW(), appeal_note = $1, updated_at = NOW()
       WHERE id = $2`,
      [appealNote || null, req.params.postId]
    );
    await recordActivity('post.appeal_requested', {
      userId: req.user.sub,
      postId: req.params.postId,
      note: appealNote
    });
    return res.json({ ok: true, message: 'Appeal submitted. An admin can review and restore the post.' });
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
    await recordActivity('social.followed_user', {
      userId: req.user.sub,
      targetUserId: req.params.userId
    });
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
    await recordActivity('social.unfollowed_user', {
      userId: req.user.sub,
      targetUserId: req.params.userId
    });
    return res.json({ ok: true });
  } finally {
    client.release();
  }
});

app.post('/api/agent/chat', optionalAuth, agentRateLimit, async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) {
    return res.status(400).json({ message: 'A message is required.' });
  }

  try {
    const result = await runAgentCommand(message, req.user);
    await recordActivity('agent.chat', {
      userId: req.user?.sub || null,
      intent: result.intent
    });
    return res.json(result);
  } catch (error) {
    console.error('Failed to process agent chat.', error);
    return res.status(500).json({ message: 'Failed to process agent request.' });
  }
});

app.post('/api/admin/posts/:postId/remove', authRequired, adminRequired, async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) {
    return res.status(400).json({ message: 'A moderation reason is required.' });
  }

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, author_id, deleted_by_admin_at
       FROM post
       WHERE id = $1`,
      [req.params.postId]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Post not found.' });
    }
    if (existing.rows[0].deleted_by_admin_at) {
      return res.status(400).json({ message: 'This post is already under moderation.' });
    }

    await client.query(
      `UPDATE post
       SET deleted_by_admin_at = NOW(),
           deleted_by_admin_id = $1,
           deleted_reason = $2,
           appeal_requested_at = NULL,
           appeal_note = NULL,
           updated_at = NOW()
       WHERE id = $3`,
      [req.user.sub, reason, req.params.postId]
    );
    await recordActivity('post.moderated_removed', {
      userId: existing.rows[0].author_id,
      postId: req.params.postId,
      moderatorId: req.user.sub,
      reason
    });
    return res.json({ ok: true, message: 'Post removed from public view. The author has 15 days to appeal.' });
  } finally {
    client.release();
  }
});

app.post('/api/admin/posts/:postId/restore', authRequired, adminRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, author_id, deleted_by_admin_at
       FROM post
       WHERE id = $1`,
      [req.params.postId]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Post not found.' });
    }
    if (!existing.rows[0].deleted_by_admin_at) {
      return res.status(400).json({ message: 'This post is not currently under moderation.' });
    }

    await client.query(
      `UPDATE post
       SET deleted_by_admin_at = NULL,
           deleted_by_admin_id = NULL,
           deleted_reason = NULL,
           appeal_requested_at = NULL,
           appeal_note = NULL,
           restored_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.postId]
    );
    await recordActivity('post.moderated_restored', {
      userId: existing.rows[0].author_id,
      postId: req.params.postId,
      moderatorId: req.user.sub
    });
    return res.json({ ok: true, message: 'Post restored.' });
  } finally {
    client.release();
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const data = await listPublicPosts(pool, mapPostRow, req.query);
    return res.json(data);
  } catch (error) {
    console.error('Failed to load public posts.', error);
    return res.status(500).json({ message: 'Failed to load posts.' });
  }
});

app.get('/api/posts/:postId', async (req, res) => {
  try {
    const post = await getPublicPostById(pool, mapPostRow, req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }
    return res.json({ post });
  } catch (error) {
    console.error('Failed to load public post detail.', error);
    return res.status(500).json({ message: 'Failed to load post detail.' });
  }
});

app.get('/api/posts/:postId/comments', async (req, res) => {
  const client = await pool.connect();
  try {
    const post = await getPublicPostMeta(client, req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const comments = await getCommentsByPost(client, req.params.postId);
    return res.json({ comments });
  } catch (error) {
    console.error('Failed to load comments.', error);
    return res.status(500).json({ message: 'Failed to load comments.' });
  } finally {
    client.release();
  }
});

app.post('/api/posts/:postId/comments', authRequired, async (req, res) => {
  const content = String(req.body?.content || '').trim();
  if (!content) {
    return res.status(400).json({ message: 'Comment content is required.' });
  }
  if (content.length > 5000) {
    return res.status(400).json({ message: 'Comment must be 5000 characters or fewer.' });
  }

  const client = await pool.connect();
  try {
    const post = await getPublicPostMeta(client, req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const created = await client.query(
      `INSERT INTO comment (post_id, author_id, content_markdown)
       VALUES ($1, $2, $3)
       RETURNING id, post_id, author_id, content_markdown, created_at, updated_at`,
      [req.params.postId, req.user.sub, content]
    );

    const author = await client.query(
      `SELECT username, email
       FROM app_user
       WHERE id = $1`,
      [req.user.sub]
    );

    await recordActivity('comment.created', {
      userId: req.user.sub,
      postId: req.params.postId,
      commentId: created.rows[0].id
    });

    return res.status(201).json({
      comment: mapCommentRow({
        ...created.rows[0],
        author_name: author.rows[0]?.username || req.user.name,
        author_email: author.rows[0]?.email || req.user.email
      })
    });
  } catch (error) {
    console.error('Failed to create comment.', error);
    return res.status(500).json({ message: 'Failed to create comment.' });
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
    await recordActivity('post.created', {
      userId: req.user.sub,
      postId: created.rows[0].id,
      title: created.rows[0].title,
      section: created.rows[0].section,
      tags: cleanTags
    });
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
      `SELECT id, author_id, created_at, deleted_by_admin_at FROM post WHERE id = $1`,
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
    if (existing.rows[0].deleted_by_admin_at) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'This post is under moderation and cannot be edited.' });
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
    await recordActivity('post.updated', {
      userId: req.user.sub,
      postId: req.params.postId,
      title: updated.rows[0].title,
      section: updated.rows[0].section,
      tags: cleanTags
    });

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
      `SELECT id, author_id, deleted_by_admin_at FROM post WHERE id = $1`,
      [req.params.postId]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Post not found.' });
    }
    if (existing.rows[0].author_id !== req.user.sub) {
      return res.status(403).json({ message: 'You can only delete your own posts.' });
    }
    if (existing.rows[0].deleted_by_admin_at) {
      return res.status(403).json({ message: 'This post is under moderation and cannot be deleted by the author.' });
    }
    await client.query(`DELETE FROM post WHERE id = $1`, [req.params.postId]);
    await recordActivity('post.deleted', {
      userId: req.user.sub,
      postId: req.params.postId
    });
    return res.json({ ok: true });
  } finally {
    client.release();
  }
});

Promise.all([
  runMigrations(pool, path.resolve(__dirname, '../migrations')),
  ensureMongoCollections(),
  ensureDuckDbReady()
])
  .then(async () => {
    const purged = await purgeExpiredModeratedPosts();
    if (purged > 0) {
      console.log(`Purged ${purged} expired moderated posts.`);
    }
    await buildDuckDbOverview();
    scheduleDailyAnalyticsRefresh();
    if (activityStore.isEnabled()) {
      console.log(`MongoDB connected to database "${activityStore.getDbName()}".`);
    } else {
      console.log('MongoDB not configured. Continuing with PostgreSQL only.');
    }
    setInterval(() => {
      purgeExpiredModeratedPosts().catch((error) => {
        console.error('Failed to purge expired moderated posts.', error);
      });
    }, 6 * 60 * 60 * 1000);
    app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize backend services.', error);
    process.exit(1);
  });
