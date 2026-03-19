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
const { createOpenAIAgentRouter } = require('./lib/openai-agent-router');
const { createOpenAIDraftService, SECTION_ENUM } = require('./lib/openai-drafts');
const { createOpenAIPostRewriter } = require('./lib/openai-post-rewriter');
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
const openAiApiKey = String(process.env.OPENAI_API_KEY || '').trim();
const openAiModel = String(process.env.OPENAI_MODEL || 'gpt-5-mini').trim() || 'gpt-5-mini';
const dailyAiUsageLimit = Number(process.env.DAILY_AI_USAGE_LIMIT || 5);

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
const openAiAgentRouter = createOpenAIAgentRouter({ apiKey: openAiApiKey, model: openAiModel });
const openAiDraftService = createOpenAIDraftService({ apiKey: openAiApiKey, model: openAiModel });
const openAiPostRewriter = createOpenAIPostRewriter({ apiKey: openAiApiKey, model: openAiModel });
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

function isDuckDbAvailable() {
  return Boolean(duckDb && duckDbReady);
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

const AGENT_TOPIC_HINTS = [
  {
    key: 'mle',
    patterns: [/\bmle\b/i, /\bmachine learning engineering\b/i, /\bmachine learning engineer\b/i],
    canonical: 'machine learning engineering',
    terms: ['mle', 'machine learning engineering', 'mlops', 'model deployment', 'feature engineering', 'training pipeline'],
    sections: ['mle', 'ai-llm', 'ds-general']
  },
  {
    key: 'machine-learning',
    patterns: [/\bmachine learning\b/i, /\bml\b/i],
    canonical: 'machine learning',
    terms: ['machine learning', 'ml', 'supervised learning', 'unsupervised learning', 'model training'],
    sections: ['mle', 'deep-learning', 'ds-general']
  },
  {
    key: 'llm',
    patterns: [/\bllm\b/i, /\blarge language model\b/i, /\bgenerative ai\b/i],
    canonical: 'llm',
    terms: ['llm', 'large language model', 'prompting', 'rag', 'agents'],
    sections: ['ai-llm', 'mle']
  },
  {
    key: 'analytics',
    patterns: [/\banalytics\b/i, /\bbi\b/i, /\bdashboard\b/i],
    canonical: 'analytics',
    terms: ['analytics', 'dashboard', 'metrics', 'reporting', 'experimentation'],
    sections: ['analytics', 'visualization', 'experimentation']
  },
  {
    key: 'backend',
    patterns: [/\bbackend\b/i, /\bapi\b/i, /\bserver\b/i],
    canonical: 'backend engineering',
    terms: ['backend', 'api', 'server', 'database', 'architecture'],
    sections: ['backend', 'system-design', 'data-engineering']
  }
];

const AGENT_TAXONOMY_CACHE_TTL_MS = 10 * 60 * 1000;
const agentTaxonomyCache = {
  loadedAt: 0,
  tags: [],
  sections: []
};

function stripMarkdownToText(content) {
  return String(content || '')
    .replace(/```[\s\S]*?```/g, ' code snippet ')
    .replace(/`[^`]+`/g, ' inline code ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~]+/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeText(content) {
  return stripMarkdownToText(content)
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function normalizeTaxonomyTerm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(content) {
  const text = stripMarkdownToText(content);
  return text ? text.split(/\s+/).length : 0;
}

function formatAgentDate(timestamp) {
  if (!timestamp) {
    return '';
  }
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function buildNavigationResponse(destinationKey, user) {
  const normalized = String(destinationKey || '').trim().toLowerCase();
  const isLoggedIn = Boolean(user?.sub);
  const isAdmin = Boolean(user?.isAdmin);

  const responses = {
    home: {
      reply: 'Opening the home page.',
      navigateTo: '/'
    },
    about: {
      reply: 'Opening the About page.',
      navigateTo: '/about'
    },
    forum: {
      reply: 'Opening the forum.',
      navigateTo: '/forum'
    },
    'forum-create-post': {
      reply: isLoggedIn ? 'Opening the forum composer.' : 'Login first, then you can create a post.',
      navigateTo: isLoggedIn ? '/forum?compose=1' : '/login'
    },
    'settings-profile': {
      reply: isLoggedIn ? 'Opening Settings and focusing the profile section.' : 'Login first, then open Settings.',
      navigateTo: isLoggedIn ? '/settings?panel=profile' : '/login'
    },
    'settings-password': {
      reply: isLoggedIn ? 'Opening Settings and focusing the password section.' : 'Login first, then open Settings.',
      navigateTo: isLoggedIn ? '/settings?panel=password' : '/login'
    },
    'settings-danger': {
      reply: isLoggedIn ? 'Opening Settings and focusing the danger zone.' : 'Login first, then open Settings.',
      navigateTo: isLoggedIn ? '/settings?panel=danger' : '/login'
    },
    'my-posts': {
      reply: isLoggedIn ? 'Opening My Posts.' : 'Login first, then open My Posts.',
      navigateTo: isLoggedIn ? '/my-posts' : '/login'
    },
    following: {
      reply: isLoggedIn ? 'Opening the Following page.' : 'Login first, then open your network page.',
      navigateTo: isLoggedIn ? '/following?tab=following' : '/login'
    },
    followers: {
      reply: isLoggedIn ? 'Opening your Followers tab.' : 'Login first, then open your network page.',
      navigateTo: isLoggedIn ? '/following?tab=followers' : '/login'
    },
    analytics: {
      reply: isAdmin ? 'Opening Analytics.' : 'Analytics is admin-only. Returning to the forum.',
      navigateTo: isAdmin ? '/analytics' : '/forum'
    },
    moderation: {
      reply: isAdmin ? 'Opening the Moderation Queue.' : 'Moderation is admin-only. Returning to the forum.',
      navigateTo: isAdmin ? '/moderation' : '/forum'
    },
    login: {
      reply: 'Opening Login.',
      navigateTo: '/login'
    }
  };

  const resolved = responses[normalized] || responses.forum;
  return {
    intent: 'navigate',
    reply: resolved.reply,
    navigateTo: resolved.navigateTo,
    autoNavigate: true,
    actions: [
      {
        label: 'Open',
        to: resolved.navigateTo
      }
    ],
    quickActions: ['search-posts', 'draft-post']
  };
}

async function consumeDailyAiUsage(client, user) {
  if (!user?.sub) {
    return {
      allowed: true,
      remaining: null,
      limit: null
    };
  }

  if (user.isAdmin) {
    return {
      allowed: true,
      remaining: null,
      limit: null
    };
  }

  const normalizedLimit = Number.isFinite(dailyAiUsageLimit) && dailyAiUsageLimit > 0
    ? Math.trunc(dailyAiUsageLimit)
    : 5;

  const result = await client.query(
    `INSERT INTO ai_daily_usage (user_id, usage_date, usage_count, last_used_at)
     VALUES ($1, CURRENT_DATE, 1, NOW())
     ON CONFLICT (user_id, usage_date) DO UPDATE
     SET usage_count = ai_daily_usage.usage_count + 1,
         last_used_at = NOW()
     RETURNING usage_count`,
    [user.sub]
  );

  const usageCount = Number(result.rows[0]?.usage_count || 0);
  if (usageCount > normalizedLimit) {
    await client.query(
      `UPDATE ai_daily_usage
       SET usage_count = GREATEST(usage_count - 1, 0), last_used_at = NOW()
       WHERE user_id = $1 AND usage_date = CURRENT_DATE`,
      [user.sub]
    );
    return {
      allowed: false,
      remaining: 0,
      limit: normalizedLimit
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, normalizedLimit - usageCount),
    limit: normalizedLimit
  };
}

function getTopEntries(counter, limit) {
  return [...counter.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([value]) => value);
}

function detectOpeningStyle(content) {
  const firstParagraph = String(content || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find(Boolean) || '';

  if (!firstParagraph) {
    return 'direct';
  }
  if (/\?/.test(firstParagraph) || /^(why|how|what|when)\b/i.test(firstParagraph)) {
    return 'question-led';
  }
  if (/^(i|we|recently|lately|after|while)\b/i.test(firstParagraph)) {
    return 'personal';
  }
  if (/(problem|issue|challenge|pain point)/i.test(firstParagraph)) {
    return 'problem-first';
  }
  return 'direct';
}

function detectClosingStyle(content) {
  const paragraphs = String(content || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const lastParagraph = paragraphs[paragraphs.length - 1] || '';

  if (!lastParagraph) {
    return 'takeaway';
  }
  if (/(next|follow-up|would improve|future work|next step)/i.test(lastParagraph)) {
    return 'next-steps';
  }
  if (/(curious|what do you think|how are you|would love to hear)/i.test(lastParagraph)) {
    return 'discussion';
  }
  if (/(takeaway|lesson|in summary|overall|bottom line)/i.test(lastParagraph)) {
    return 'takeaway';
  }
  return 'practical';
}

function detectTitlePattern(posts) {
  if (!posts.length) {
    return 'statement';
  }

  let questionCount = 0;
  let colonCount = 0;
  let howToCount = 0;
  for (const post of posts) {
    const title = String(post.title || '').trim();
    if (!title) {
      continue;
    }
    if (title.includes('?')) {
      questionCount += 1;
    }
    if (title.includes(':')) {
      colonCount += 1;
    }
    if (/^how\b/i.test(title)) {
      howToCount += 1;
    }
  }

  if (questionCount / posts.length >= 0.34) {
    return 'question';
  }
  if (howToCount / posts.length >= 0.25) {
    return 'how-to';
  }
  if (colonCount / posts.length >= 0.34) {
    return 'label-colon';
  }
  return 'statement';
}

function buildWritingStyleProfile(posts) {
  if (!posts.length) {
    return null;
  }

  const sectionCounts = new Map();
  const tagCounts = new Map();
  const structureCounts = new Map();
  const titleWordCounts = [];
  const bodyWordCounts = [];
  const tokenCounts = new Map();
  let firstPersonHits = 0;
  let analyticalHits = 0;
  let tutorialHits = 0;
  let questionCloseHits = 0;
  let personalOpeningHits = 0;
  let questionOpeningHits = 0;
  let problemOpeningHits = 0;
  let nextStepCloseHits = 0;
  let takeawayCloseHits = 0;

  for (const post of posts) {
    const content = String(post.content || '');
    const plainText = stripMarkdownToText(content);
    const wordCount = countWords(content);
    const titleWordCount = countWords(post.title);
    bodyWordCounts.push(wordCount);
    titleWordCounts.push(titleWordCount);

    sectionCounts.set(post.section, (sectionCounts.get(post.section) || 0) + 1);
    for (const tag of post.tags || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }

    if (/^#{1,3}\s/m.test(content)) {
      structureCounts.set('headings', (structureCounts.get('headings') || 0) + 1);
    }
    if (/^\s*([-*]|\d+\.)\s+/m.test(content)) {
      structureCounts.set('lists', (structureCounts.get('lists') || 0) + 1);
    }
    if (/```/.test(content)) {
      structureCounts.set('code-blocks', (structureCounts.get('code-blocks') || 0) + 1);
    }
    if (/\n\s*\n/.test(content)) {
      structureCounts.set('multi-section', (structureCounts.get('multi-section') || 0) + 1);
    }

    if (/\b(i|we|my|our)\b/i.test(plainText)) {
      firstPersonHits += 1;
    }
    if (/\b(tradeoff|latency|benchmark|result|metric|because|compared|compare)\b/i.test(plainText)) {
      analyticalHits += 1;
    }
    if (/\b(step|guide|walkthrough|implementation|setup|pattern|example)\b/i.test(plainText)) {
      tutorialHits += 1;
    }
    if (/\?\s*$/.test(String(post.title || '').trim()) || /\?/.test(plainText.slice(-180))) {
      questionCloseHits += 1;
    }

    const openingStyle = detectOpeningStyle(content);
    if (openingStyle === 'personal') {
      personalOpeningHits += 1;
    } else if (openingStyle === 'question-led') {
      questionOpeningHits += 1;
    } else if (openingStyle === 'problem-first') {
      problemOpeningHits += 1;
    }

    const closingStyle = detectClosingStyle(content);
    if (closingStyle === 'next-steps') {
      nextStepCloseHits += 1;
    } else if (closingStyle === 'takeaway') {
      takeawayCloseHits += 1;
    }

    for (const token of tokenizeText(`${post.title} ${content}`)) {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    }
  }

  const sampleSize = posts.length;
  const avgWordCount = Math.round(bodyWordCounts.reduce((sum, value) => sum + value, 0) / sampleSize);
  const avgTitleLength = Math.round(titleWordCounts.reduce((sum, value) => sum + value, 0) / sampleSize);
  const preferredSections = getTopEntries(sectionCounts, 3);
  const commonTags = getTopEntries(tagCounts, 6);
  const structure = getTopEntries(structureCounts, 4);
  const recurringTerms = getTopEntries(
    new Map(
      [...tokenCounts.entries()].filter(([token, count]) => {
        if (count < 2) {
          return false;
        }
        return ![
          'that',
          'this',
          'with',
          'from',
          'have',
          'your',
          'about',
          'there',
          'their',
          'when',
          'what',
          'which',
          'into',
          'while',
          'using',
          'after',
          'before'
        ].includes(token);
      })
    ),
    8
  );

  const tone = [];
  if (avgWordCount <= 160) {
    tone.push('concise');
  } else if (avgWordCount >= 320) {
    tone.push('in-depth');
  } else {
    tone.push('balanced');
  }
  if (tutorialHits / sampleSize >= 0.4) {
    tone.push('instructional');
  }
  if (analyticalHits / sampleSize >= 0.34) {
    tone.push('analytical');
  }
  if (firstPersonHits / sampleSize >= 0.34) {
    tone.push('personal');
  } else {
    tone.push('direct');
  }

  let openerStyle = 'direct';
  if (personalOpeningHits >= questionOpeningHits && personalOpeningHits >= problemOpeningHits && personalOpeningHits > 0) {
    openerStyle = 'personal';
  } else if (questionOpeningHits >= problemOpeningHits && questionOpeningHits > 0) {
    openerStyle = 'question-led';
  } else if (problemOpeningHits > 0) {
    openerStyle = 'problem-first';
  }

  let closingStyle = 'practical';
  if (nextStepCloseHits >= takeawayCloseHits && nextStepCloseHits > 0) {
    closingStyle = 'next-steps';
  } else if (questionCloseHits > 0) {
    closingStyle = 'discussion';
  } else if (takeawayCloseHits > 0) {
    closingStyle = 'takeaway';
  }

  const sectionSummary = preferredSections.length ? preferredSections.join(', ') : 'general engineering topics';
  const structureSummary = structure.length ? structure.join(', ') : 'short narrative paragraphs';
  const tagSummary = commonTags.length ? ` Common tags: ${commonTags.join(', ')}.` : '';

  return {
    sampleSize,
    avgWordCount,
    avgTitleLength,
    preferredSections,
    commonTags,
    tone,
    structure,
    openerStyle,
    closingStyle,
    titlePattern: detectTitlePattern(posts),
    recurringTerms,
    summary: `Usually writes ${tone.join(', ')} posts in ${sectionSummary} with ${structureSummary}.${tagSummary}`,
    referencePostIds: posts.slice(0, 5).map((post) => post.id)
  };
}

function scoreReferencePost(post, topicTokens) {
  if (!topicTokens.length) {
    return 0;
  }

  const titleTokens = new Set(tokenizeText(post.title));
  const contentTokens = new Set(tokenizeText(post.content));
  const tagTokens = new Set((post.tags || []).map((tag) => String(tag || '').toLowerCase()));
  let score = 0;

  for (const token of topicTokens) {
    if (titleTokens.has(token)) {
      score += 4;
    }
    if (tagTokens.has(token)) {
      score += 3;
    }
    if (contentTokens.has(token)) {
      score += 1;
    }
  }

  return score;
}

function pickReferencePosts(posts, topic) {
  if (!posts.length) {
    return [];
  }

  const topicTokens = tokenizeText(topic);
  const ranked = posts
    .map((post) => ({ post, score: scoreReferencePost(post, topicTokens) }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.post.createdAt - left.post.createdAt;
    });

  const matches = ranked.filter((entry) => entry.score > 0).slice(0, 3).map((entry) => entry.post);
  if (matches.length > 0) {
    return matches;
  }
  return posts.slice(0, 3);
}

function composeDraftTitle(topic, styleProfile) {
  const cleanTopic = String(topic || 'a practical engineering lesson').trim();
  const readableTopic = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);

  if (!styleProfile) {
    return `Practical notes on ${readableTopic}`;
  }
  if (styleProfile.titlePattern === 'question') {
    return `What actually helps with ${cleanTopic}?`;
  }
  if (styleProfile.titlePattern === 'how-to') {
    return `How I approach ${cleanTopic}`;
  }
  if (styleProfile.titlePattern === 'label-colon') {
    return `${readableTopic}: what changed for me`;
  }
  return `Practical notes on ${readableTopic}`;
}

function buildDraftTags(explicitTags, styleProfile, topic) {
  const topicTokens = tokenizeText(topic);
  const profileTags = (styleProfile?.commonTags || []).filter((tag) => topicTokens.includes(tag));
  return normalizeTags([
    ...explicitTags,
    ...profileTags,
    ...(explicitTags.length ? [] : (styleProfile?.commonTags || []).slice(0, 3))
  ]).slice(0, 4);
}

function buildPersonalizedDraftContent({ topic, styleProfile, referencePosts }) {
  const cleanTopic = String(topic || 'a practical engineering lesson').trim();
  const intro = styleProfile?.openerStyle === 'personal'
    ? `I've been revisiting ${cleanTopic} lately, and this is the pattern that keeps proving reliable.`
    : styleProfile?.openerStyle === 'question-led'
      ? `What does a dependable ${cleanTopic} workflow actually look like when you need to ship it?`
      : styleProfile?.openerStyle === 'problem-first'
        ? `${cleanTopic.charAt(0).toUpperCase()}${cleanTopic.slice(1)} usually breaks down when the implementation details get fuzzy.`
        : `Here is a practical breakdown of ${cleanTopic} based on what has worked well so far.`;

  const referenceLine = referencePosts.length > 0
    ? `This draft leans on patterns from earlier posts like "${referencePosts[0].title}"${referencePosts[1] ? ` and "${referencePosts[1].title}"` : ''}.`
    : `This draft stays grounded in practical details instead of broad theory.`;

  const usesLists = styleProfile?.structure?.includes('lists');
  const usesCodeBlocks = styleProfile?.structure?.includes('code-blocks');
  const usesHeadings = styleProfile ? styleProfile.structure?.includes('headings') : true;
  const close = styleProfile?.closingStyle === 'discussion'
    ? `Curious how other teams are handling ${cleanTopic} right now.`
    : styleProfile?.closingStyle === 'next-steps'
      ? `Next I want to tighten the rough edges and see how this holds up under heavier usage.`
      : styleProfile?.closingStyle === 'takeaway'
        ? `The main takeaway is that ${cleanTopic} gets easier once the workflow is explicit and repeatable.`
        : `The useful part was keeping the solution concrete enough that someone else could repeat it.`;

  if (!usesHeadings) {
    return [
      intro,
      '',
      referenceLine,
      '',
      `The context was straightforward: I needed a repeatable way to handle ${cleanTopic} without adding unnecessary process.`,
      '',
      usesLists
        ? `What mattered most:\n- make the workflow explicit\n- remove avoidable handoffs\n- keep the output easy to review\n- document the tradeoffs`
        : `What mattered most was making the workflow explicit, removing avoidable handoffs, and keeping the result easy to review.`,
      '',
      usesCodeBlocks ? `A lightweight implementation sketch:\n\n\`\`\`txt\ninput -> decision rules -> generated draft -> human review\n\`\`\`\n` : '',
      close
    ].filter(Boolean).join('\n');
  }

  return [
    intro,
    '',
    '## Context',
    referenceLine,
    '',
    `The immediate goal was to make ${cleanTopic} easier to execute without losing the reasoning behind the decision.`,
    '',
    '## Approach',
    usesLists
      ? [
          '- define the workflow in one place',
          '- keep the decision points visible',
          '- generate a draft that is already close to publishable',
          '- leave room for fast human review before posting'
        ].join('\n')
      : `I kept the workflow narrow: define the decision points, generate a draft that is close to publishable, and leave a fast review step before publishing.`,
    '',
    '## What worked',
    `The biggest gain was consistency. The draft stays aligned with the usual tone, section choices, and level of detail instead of starting from a blank page every time.`,
    '',
    usesCodeBlocks ? '```txt\nhistory -> style profile -> topic request -> draft -> publish\n```' : '',
    usesCodeBlocks ? '' : '',
    styleProfile?.closingStyle === 'next-steps' ? '## What I would improve next' : '## Takeaway',
    close
  ].filter(Boolean).join('\n');
}

async function storeUserWritingProfile(client, userId, profile) {
  if (!userId || !profile) {
    return null;
  }

  await client.query(
    `INSERT INTO user_writing_profile (user_id, sample_size, reference_post_ids, profile_json, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE
     SET sample_size = EXCLUDED.sample_size,
         reference_post_ids = EXCLUDED.reference_post_ids,
         profile_json = EXCLUDED.profile_json,
         updated_at = NOW()`,
    [userId, profile.sampleSize, profile.referencePostIds, JSON.stringify(profile)]
  );

  return {
    ...profile,
    updatedAt: Date.now()
  };
}

async function refreshUserWritingProfile(client, userId) {
  if (!userId) {
    return { styleProfile: null, posts: [] };
  }

  const posts = (await getPostsByAuthor(client, userId)).slice(0, 12);
  const profile = buildWritingStyleProfile(posts);

  if (!profile) {
    await client.query(`DELETE FROM user_writing_profile WHERE user_id = $1`, [userId]);
    return { styleProfile: null, posts };
  }

  const storedProfile = await storeUserWritingProfile(client, userId, profile);
  return {
    styleProfile: storedProfile,
    posts
  };
}

async function buildDraftWithUserStyle(message, user) {
  const client = await pool.connect();
  try {
    const { styleProfile, posts } = await refreshUserWritingProfile(client, user?.sub);
    const fallbackDraft = buildDraftFromMessage(message);

    if (!styleProfile || posts.length === 0) {
      return {
        draft: fallbackDraft,
        styleProfile: null,
        referencePosts: [],
        personalized: false,
        generation: {
          mode: 'template',
          provider: 'local',
          model: null,
          fallback: false
        }
      };
    }

    const explicitTitle = extractQuotedValue(message, 'title');
    const explicitSection = extractQuotedValue(message, 'section') || pickSectionFromMessage(message);
    const explicitTopic = extractQuotedValue(message, 'topic') || String(message || '')
      .replace(/^(write|generate|draft|compose|help me post|create a post|publish|post this|submit this|请|帮我|写一篇|生成|发一个)\s*/i, '')
      .trim();
    const topic = explicitTopic || 'a practical engineering lesson';
    const referencePosts = pickReferencePosts(posts, topic);
    let generation = {
      mode: 'template',
      provider: 'local',
      model: null,
      fallback: false
    };
    let draft = {
      title: explicitTitle || composeDraftTitle(topic, styleProfile),
      section: explicitSection || styleProfile.preferredSections[0] || fallbackDraft.section,
      tags: buildDraftTags(extractTagsFromMessage(message), styleProfile, topic),
      content: buildPersonalizedDraftContent({ topic, styleProfile, referencePosts })
    };

    if (openAiDraftService.isEnabled()) {
      try {
        const aiResult = await openAiDraftService.createDraft({
          message,
          styleProfile,
          referencePosts,
          fallbackDraft: {
            ...fallbackDraft,
            ...draft
          },
          currentUserName: user?.name || ''
        });
        if (aiResult?.draft) {
          draft = aiResult.draft;
          generation = {
            mode: 'llm',
            provider: aiResult.provider || 'openai',
            model: aiResult.model || openAiDraftService.getModel(),
            fallback: false,
            rationale: aiResult.rationale || ''
          };
        }
      } catch (error) {
        console.error('OpenAI personalized drafting failed. Falling back to template draft.', error);
        generation = {
          mode: 'template',
          provider: 'local',
          model: openAiDraftService.getModel(),
          fallback: true
        };
      }
    }

    return {
      draft,
      styleProfile,
      referencePosts,
      personalized: true,
      generation
    };
  } finally {
    client.release();
  }
}

function detectAgentIntent(message) {
  const text = String(message || '').toLowerCase();
  if (/(most recent|latest|newest|recent).*(post|posts)|最近.*post|最近.*帖子|最新.*post|最新.*帖子/.test(text)) {
    return 'latest-posts';
  }
  if (/(most recent|latest|newest|recent).*(announcement|announcements|update|updates)|what is the most recent announcement|最新.*公告|最近.*公告|最新.*更新|最近.*更新/.test(text)) {
    return 'latest-announcement';
  }
  if (/(go to|open|take me to|bring me to|navigate to|show me the).*(home|homepage|home page|about|settings|password|forum|analytics|moderation|followers|following|my posts|login|sign in|create post)|change my password|open about page|go to about page|go home|bring me home|带我去|打开.*页面|跳转到/.test(text)) {
    return 'navigate';
  }
  if (/(rewrite|improve|polish|refine|edit|make it shorter|make it longer|expand|shorten).*(post|article)|help me improve my post|帮我改帖子|润色我的帖子|修改我的帖子/.test(text)) {
    return 'rewrite';
  }
  if (/(publish|post this|submit this|create post from|send this|发布|发帖|直接发)/.test(text)) {
    return 'publish';
  }
  if (/(learn|study|understand|get started|recommend.*posts?|what should i read|want to learn|想学习|学习一下|推荐.*帖子|推荐.*文章)/.test(text)) {
    return 'learn';
  }
  if (/(draft|write|generate|compose|help me post|create a post|草稿|写一篇|帮我写|生成帖子|生成一个帖子)/.test(text)) {
    return 'draft';
  }
  if (/(hot|popular|top author|top authors|trending|best posts|best authors|热门|趋势|活跃作者)/.test(text)) {
    return 'trending';
  }
  if (/(search|find|look for|related post|related posts|posts about|query|搜索|查找|相关文章|相关帖子)/.test(text)) {
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
  return SECTION_ENUM.find((section) => normalized.includes(section)) || '';
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

function normalizeAgentSearchQuery(message) {
  return String(message || '')
    .replace(/^(search|find|look for|show|recommend)\s+/i, '')
    .replace(/^(posts?|articles?)\s+(about|on)\s+/i, '')
    .replace(/^(related\s+posts?)\s+/i, '')
    .replace(/^(i\s+want\s+to\s+learn|i\s+want\s+to\s+study|i\s+want\s+to\s+understand)\s+/i, '')
    .replace(/^(learn|study|understand|get started with|read about)\s+/i, '')
    .replace(/^(about|on)\s+/i, '')
    .replace(/^(some|more)\s+/i, '')
    .trim();
}

function buildAgentSearchProfile(message) {
  const normalizedMessage = String(message || '').trim();
  const cleanedQuery = normalizeAgentSearchQuery(normalizedMessage);
  const topic = cleanedQuery || normalizedMessage;
  const rawTokens = tokenizeText(topic);
  const phraseTerms = [];
  const suggestedSections = new Set();
  let canonicalTopic = topic;

  for (const hint of AGENT_TOPIC_HINTS) {
    if (hint.patterns.some((pattern) => pattern.test(normalizedMessage) || pattern.test(topic))) {
      canonicalTopic = hint.canonical;
      hint.terms.forEach((term) => phraseTerms.push(term));
      hint.sections.forEach((section) => suggestedSections.add(section));
    }
  }

  const tokens = new Set(rawTokens);
  for (const term of phraseTerms) {
    tokenizeText(term).forEach((token) => tokens.add(token));
  }

  const searchPhrases = [...new Set([
    topic,
    canonicalTopic,
    ...phraseTerms
  ].map((value) => String(value || '').trim()).filter(Boolean))];

  return {
    topic: topic || 'recent forum topics',
    canonicalTopic,
    tokens: [...tokens],
    searchPhrases,
    suggestedSections: [...suggestedSections]
  };
}

function taxonomyEntryMatchesQuery(entry, queryText, queryTokens) {
  const normalizedEntry = normalizeTaxonomyTerm(entry);
  if (!normalizedEntry) {
    return false;
  }

  if (queryText === normalizedEntry) {
    return true;
  }

  if (queryText.length >= 4 && (queryText.includes(normalizedEntry) || normalizedEntry.includes(queryText))) {
    return true;
  }

  const entryTokens = tokenizeText(normalizedEntry);
  if (!entryTokens.length || !queryTokens.length) {
    return false;
  }

  return entryTokens.every((token) => queryTokens.includes(token));
}

async function getAgentSearchTaxonomy(client) {
  if (agentTaxonomyCache.loadedAt && Date.now() - agentTaxonomyCache.loadedAt < AGENT_TAXONOMY_CACHE_TTL_MS) {
    return agentTaxonomyCache;
  }

  const [tagsResult, sectionsResult] = await Promise.all([
    client.query(`SELECT name FROM tag ORDER BY name ASC LIMIT 500`),
    client.query(
      `SELECT DISTINCT section
       FROM post
       WHERE is_published = TRUE
         AND deleted_by_admin_at IS NULL
       ORDER BY section ASC`
    )
  ]);

  agentTaxonomyCache.loadedAt = Date.now();
  agentTaxonomyCache.tags = tagsResult.rows.map((row) => String(row.name || '').trim()).filter(Boolean);
  agentTaxonomyCache.sections = sectionsResult.rows.map((row) => String(row.section || '').trim()).filter(Boolean);
  return agentTaxonomyCache;
}

async function enrichAgentSearchProfile(client, searchProfile) {
  const taxonomy = await getAgentSearchTaxonomy(client);
  const queryText = normalizeTaxonomyTerm(searchProfile.topic);
  const queryTokens = tokenizeText(queryText);
  const matchedTags = taxonomy.tags.filter((tag) => taxonomyEntryMatchesQuery(tag, queryText, queryTokens));
  const matchedSections = taxonomy.sections.filter((section) => taxonomyEntryMatchesQuery(section, queryText, queryTokens));

  if (!matchedTags.length && !matchedSections.length) {
    return searchProfile;
  }

  const tokens = new Set(searchProfile.tokens);
  const searchPhrases = new Set(searchProfile.searchPhrases);
  const suggestedSections = new Set(searchProfile.suggestedSections);

  for (const tag of matchedTags) {
    searchPhrases.add(tag);
    tokenizeText(tag).forEach((token) => tokens.add(token));
  }

  for (const section of matchedSections) {
    suggestedSections.add(section);
    searchPhrases.add(section);
    searchPhrases.add(normalizeTaxonomyTerm(section));
    tokenizeText(section).forEach((token) => tokens.add(token));
  }

  return {
    ...searchProfile,
    tokens: [...tokens],
    searchPhrases: [...searchPhrases],
    suggestedSections: [...suggestedSections]
  };
}

function scoreAgentSearchPost(post, searchProfile) {
  const titleText = String(post.title || '').toLowerCase();
  const bodyText = stripMarkdownToText(post.content).toLowerCase();
  const tags = (post.tags || []).map((tag) => String(tag || '').toLowerCase());
  const titleTokens = new Set(tokenizeText(post.title));
  const contentTokens = new Set(tokenizeText(post.content));
  let score = 0;

  for (const phrase of searchProfile.searchPhrases) {
    if (!phrase) {
      continue;
    }
    const phraseText = phrase.toLowerCase();
    if (titleText.includes(phraseText)) {
      score += 8;
    }
    if (bodyText.includes(phraseText)) {
      score += 3;
    }
    if (tags.some((tag) => tag.includes(phraseText))) {
      score += 6;
    }
  }

  for (const token of searchProfile.tokens) {
    if (titleTokens.has(token)) {
      score += 4;
    }
    if (contentTokens.has(token)) {
      score += 1;
    }
    if (tags.includes(token)) {
      score += 5;
    }
  }

  if (searchProfile.suggestedSections.includes(post.section)) {
    score += 5;
  }

  return score;
}

async function searchPublicPostsForAgent(message, limit = 5) {
  const client = await pool.connect();
  try {
    const searchProfile = await enrichAgentSearchProfile(client, buildAgentSearchProfile(message));
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
       GROUP BY p.id, u.username, u.email
       ORDER BY p.created_at DESC
       LIMIT 150`
    );
    return result.rows
      .map(mapPostRow)
      .map((post) => ({ post, score: scoreAgentSearchPost(post, searchProfile) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return right.post.createdAt - left.post.createdAt;
      })
      .slice(0, limit)
      .map((entry) => entry.post);
  } finally {
    client.release();
  }
}

async function getLatestAnnouncementPosts(limit = 3) {
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
       WHERE p.is_published = TRUE
         AND p.deleted_by_admin_at IS NULL
         AND p.section = ANY($1)
       GROUP BY p.id, u.username, u.email
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [['announcements', 'system-update'], limit]
    );
    return result.rows.map(mapPostRow);
  } finally {
    client.release();
  }
}

async function getLatestPublicPosts(limit = 5) {
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
       WHERE p.is_published = TRUE
         AND p.deleted_by_admin_at IS NULL
         AND p.section <> ALL($1)
       GROUP BY p.id, u.username, u.email
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [['announcements', 'system-update'], limit]
    );
    return result.rows.map(mapPostRow);
  } finally {
    client.release();
  }
}

function buildRewriteEditorPath(postId) {
  const params = new URLSearchParams({
    postId,
    mode: 'ai-rewrite'
  });
  return `/my-posts?${params.toString()}`;
}

function scoreUserPostForRewrite(post, query) {
  const tokens = tokenizeText(query);
  if (!tokens.length) {
    return 0;
  }

  const titleTokens = new Set(tokenizeText(post.title));
  const contentTokens = new Set(tokenizeText(post.content));
  let score = 0;
  for (const token of tokens) {
    if (titleTokens.has(token)) {
      score += 5;
    }
    if (contentTokens.has(token)) {
      score += 1;
    }
  }
  return score;
}

async function buildRewriteWorkspaceResponse(query, user) {
  if (!user?.sub) {
    return {
      intent: 'rewrite',
      reply: 'Login first, then open My Posts to use AI Rewrite on one of your posts.',
      actions: [
        {
          label: 'Login',
          to: '/login'
        }
      ],
      quickActions: ['draft-post']
    };
  }

  const client = await pool.connect();
  try {
    const { posts } = await refreshUserWritingProfile(client, user.sub);
    const activePosts = posts.filter((post) => !post.moderation?.isDeleted);
    if (!activePosts.length) {
      return {
        intent: 'rewrite',
        reply: 'You do not have any active posts to rewrite yet. Publish a post first, then AI Rewrite will be available in My Posts.',
        actions: [
          {
            label: 'Go to Forum',
            to: '/forum'
          }
        ],
        quickActions: ['draft-post']
      };
    }

    const ranked = activePosts
      .map((post) => ({ post, score: scoreUserPostForRewrite(post, query) }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return right.post.createdAt - left.post.createdAt;
      });

    const bestMatch = ranked[0];
    if (bestMatch && bestMatch.score >= 5) {
      return {
        intent: 'rewrite',
        reply: `Open AI Rewrite for "${bestMatch.post.title}" in My Posts. I linked it below so you can jump straight into the rewrite panel.`,
        actions: [
          {
            label: 'Open AI Rewrite',
            to: buildRewriteEditorPath(bestMatch.post.id)
          }
        ],
        workspacePosts: [
          {
            id: bestMatch.post.id,
            title: bestMatch.post.title,
            section: bestMatch.post.section,
            to: buildRewriteEditorPath(bestMatch.post.id)
          }
        ],
        quickActions: ['draft-post', 'search-posts']
      };
    }

    const options = ranked.slice(0, 4).map(({ post }) => ({
      id: post.id,
      title: post.title,
      section: post.section,
      to: buildRewriteEditorPath(post.id)
    }));

    return {
      intent: 'rewrite',
      reply: 'Choose one of your posts below to open AI Rewrite in My Posts.',
      workspacePosts: options,
      actions: [
        {
          label: 'Open My Posts',
          to: '/my-posts'
        }
      ],
      quickActions: ['draft-post', 'search-posts']
    };
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

async function runRuleBasedAgentCommand(message, user) {
  const intent = detectAgentIntent(message);

  if (intent === 'navigate') {
    const text = String(message || '').toLowerCase();
    let destination = 'forum';
    if (/(^home$|home page|homepage|landing page|go home|bring me home)/.test(text)) {
      destination = 'home';
    } else if (/(about)/.test(text)) {
      destination = 'about';
    } else if (/(change my password|password)/.test(text)) {
      destination = 'settings-password';
    } else if (/(settings|profile)/.test(text)) {
      destination = 'settings-profile';
    } else if (/(delete account|danger)/.test(text)) {
      destination = 'settings-danger';
    } else if (/(my posts|my post)/.test(text)) {
      destination = 'my-posts';
    } else if (/(followers)/.test(text)) {
      destination = 'followers';
    } else if (/(following)/.test(text)) {
      destination = 'following';
    } else if (/(analytics)/.test(text)) {
      destination = 'analytics';
    } else if (/(moderation)/.test(text)) {
      destination = 'moderation';
    } else if (/(login|sign in)/.test(text)) {
      destination = 'login';
    } else if (/(create post|write post|new post|composer)/.test(text)) {
      destination = 'forum-create-post';
    }
    return buildNavigationResponse(destination, user);
  }

  if (intent === 'latest-announcement') {
    const posts = await getLatestAnnouncementPosts(3);
    const latestPost = posts[0] || null;
    return {
      intent,
      reply: latestPost
        ? `The most recent announcement is "${latestPost.title}", published on ${formatAgentDate(latestPost.createdAt)}. I also included the next recent updates below.`
        : 'I could not find any announcement posts yet.',
      posts,
      quickActions: ['search-posts', 'show-trending']
    };
  }

  if (intent === 'latest-posts') {
    const posts = await getLatestPublicPosts(5);
    const latestPost = posts[0] || null;
    return {
      intent,
      reply: latestPost
        ? `The most recent forum post is "${latestPost.title}", published on ${formatAgentDate(latestPost.createdAt)}. I also included a few more recent posts below.`
        : 'I could not find any recent forum posts yet.',
      posts,
      quickActions: ['search-posts', 'show-trending']
    };
  }

  if (intent === 'rewrite') {
    return buildRewriteWorkspaceResponse(message, user);
  }

  if (intent === 'search' || intent === 'learn') {
    const searchProfile = buildAgentSearchProfile(message);
    const posts = await searchPublicPostsForAgent(message, 6);
    return {
      intent,
      reply: posts.length
        ? intent === 'learn'
          ? `If you want to learn ${searchProfile.canonicalTopic}, these posts are a strong place to start.`
          : `I found ${posts.length} related posts about ${searchProfile.canonicalTopic}.`
        : intent === 'learn'
          ? `I could not find good starter posts for ${searchProfile.canonicalTopic}. Try a more specific topic like "MLOps", "feature engineering", or "supervised learning".`
          : 'I could not find matching posts. Try a tag, section, or a more specific phrase.',
      posts,
      quickActions: intent === 'learn'
        ? ['search-posts', 'draft-post']
        : ['show-trending', 'draft-post']
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
    const { draft, styleProfile, referencePosts, personalized, generation } = user
      ? await buildDraftWithUserStyle(message, user)
      : {
          draft: buildDraftFromMessage(message),
          styleProfile: null,
          referencePosts: [],
          personalized: false,
          generation: {
            mode: 'template',
            provider: 'local',
            model: null,
            fallback: false
          }
        };
    return {
      intent,
      reply: personalized
        ? intent === 'publish'
          ? `I prepared a publish-ready draft using your last ${styleProfile.sampleSize} posts as a style reference${generation?.provider === 'openai' ? ` and ${generation.model}` : ''}.`
          : `I drafted this in your usual style based on your last ${styleProfile.sampleSize} posts${generation?.provider === 'openai' ? ` with ${generation.model}` : ''}.`
        : intent === 'publish'
          ? 'I prepared a publish-ready draft. Review it before posting.'
          : user
            ? 'I drafted a post outline. Publish a few more posts and I will match your forum style more closely.'
            : 'I drafted a post outline you can review, edit, or publish.',
      draft,
      styleProfile,
      referencePosts,
      generation,
      quickActions: user ? ['publish-draft', 'search-posts'] : ['login-to-publish', 'search-posts']
    };
  }

  return {
    intent: 'help',
    reply: user
      ? 'I can search related posts, show active authors, and draft a new post in your usual forum style. Try: "draft a post in my style about password reset".'
      : 'I can search related posts, show active authors, draft a new post, or help you publish a draft. Try: "find posts about mongodb", "show top authors", or "draft a post about password reset".',
    quickActions: ['search-posts', 'show-trending', 'draft-post']
  };
}

async function executeAgentRoute(route, originalMessage, user) {
  const safeRoute = route || {};

  if (safeRoute.tool === 'latest_posts') {
    const posts = await getLatestPublicPosts(Math.min(Math.max(safeRoute.limit || 5, 1), 5));
    const latestPost = posts[0] || null;
    return {
      intent: 'latest-posts',
      reply: latestPost
        ? `The most recent forum post is "${latestPost.title}", published on ${formatAgentDate(latestPost.createdAt)}.`
        : 'I could not find any recent forum posts yet.',
      posts,
      quickActions: ['search-posts', 'show-trending'],
      routing: {
        provider: safeRoute.provider || 'openai',
        model: safeRoute.model || openAiModel,
        rationale: safeRoute.rationale || ''
      }
    };
  }

  if (safeRoute.tool === 'latest_announcements') {
    const posts = await getLatestAnnouncementPosts(Math.min(Math.max(safeRoute.limit || 3, 1), 5));
    const latestPost = posts[0] || null;
    return {
      intent: 'latest-announcement',
      reply: latestPost
        ? `The most recent announcement is "${latestPost.title}", published on ${formatAgentDate(latestPost.createdAt)}.`
        : 'I could not find any announcement posts yet.',
      posts,
      quickActions: ['search-posts', 'show-trending'],
      routing: {
        provider: safeRoute.provider || 'openai',
        model: safeRoute.model || openAiModel,
        rationale: safeRoute.rationale || ''
      }
    };
  }

  if (safeRoute.tool === 'trending_authors') {
    const snapshot = await getTrendingAgentSnapshot();
    return {
      intent: 'trending',
      reply: 'Here are the most active authors and a few recent posts worth checking.',
      posts: snapshot.posts,
      authors: snapshot.authors,
      quickActions: ['search-posts', 'draft-post'],
      routing: {
        provider: safeRoute.provider || 'openai',
        model: safeRoute.model || openAiModel,
        rationale: safeRoute.rationale || ''
      }
    };
  }

  if (safeRoute.tool === 'draft_post') {
    const draftRequest = safeRoute.query || originalMessage;
    const { draft, styleProfile, referencePosts, personalized, generation } = user
      ? await buildDraftWithUserStyle(draftRequest, user)
      : {
          draft: buildDraftFromMessage(draftRequest),
          styleProfile: null,
          referencePosts: [],
          personalized: false,
          generation: {
            mode: 'template',
            provider: 'local',
            model: null,
            fallback: false
          }
        };
    return {
      intent: detectAgentIntent(originalMessage) === 'publish' ? 'publish' : 'draft',
      reply: personalized
        ? `I drafted this in your usual style based on your recent posts${generation?.provider === 'openai' ? ` with ${generation.model}` : ''}.`
        : user
          ? 'I drafted a post outline. Publish a few more posts and I will match your forum style more closely.'
          : 'I drafted a post outline you can review, edit, or publish.',
      draft,
      styleProfile,
      referencePosts,
      generation,
      quickActions: user ? ['publish-draft', 'search-posts'] : ['login-to-publish', 'search-posts'],
      routing: {
        provider: safeRoute.provider || 'openai',
        model: safeRoute.model || openAiModel,
        rationale: safeRoute.rationale || ''
      }
    };
  }

  if (safeRoute.tool === 'rewrite_existing_post') {
    const response = await buildRewriteWorkspaceResponse(safeRoute.query || originalMessage, user);
    return {
      ...response,
      routing: {
        provider: safeRoute.provider || 'openai',
        model: safeRoute.model || openAiModel,
        rationale: safeRoute.rationale || ''
      }
    };
  }

  if (safeRoute.tool === 'navigate_page') {
    const response = buildNavigationResponse(safeRoute.query || 'forum', user);
    return {
      ...response,
      routing: {
        provider: safeRoute.provider || 'openai',
        model: safeRoute.model || openAiModel,
        rationale: safeRoute.rationale || ''
      }
    };
  }

  if (safeRoute.tool === 'search_posts') {
    const query = safeRoute.query || originalMessage;
    const searchProfile = buildAgentSearchProfile(query);
    const isLearning = /(learn|study|understand|get started|what should i read|want to learn|推荐|学习)/i.test(originalMessage);
    const posts = await searchPublicPostsForAgent(query, Math.min(Math.max(safeRoute.limit || 6, 1), 8));
    return {
      intent: isLearning ? 'learn' : 'search',
      reply: posts.length
        ? isLearning
          ? `If you want to learn ${searchProfile.canonicalTopic}, these posts are a strong place to start.`
          : `I found ${posts.length} related posts about ${searchProfile.canonicalTopic}.`
        : isLearning
          ? `I could not find good starter posts for ${searchProfile.canonicalTopic}. Try a more specific topic like "MLOps", "feature engineering", or "supervised learning".`
          : 'I could not find matching posts. Try a tag, section, or a more specific phrase.',
      posts,
      quickActions: isLearning ? ['search-posts', 'draft-post'] : ['show-trending', 'draft-post'],
      routing: {
        provider: safeRoute.provider || 'openai',
        model: safeRoute.model || openAiModel,
        rationale: safeRoute.rationale || ''
      }
    };
  }

  return runRuleBasedAgentCommand(originalMessage, user);
}

async function runAgentCommand(message, user) {
  if (openAiAgentRouter.isEnabled()) {
    try {
      const route = await openAiAgentRouter.routeMessage({ message, user });
      return await executeAgentRoute(route, message, user);
    } catch (error) {
      console.error('OpenAI agent routing failed. Falling back to rule-based routing.', error);
    }
  }

  return runRuleBasedAgentCommand(message, user);
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
  if (!isDuckDbAvailable()) {
    return res.status(503).json({ message: 'Analytics is temporarily unavailable.' });
  }
  try {
    const analytics = await buildDuckDbOverview(req.query);
    return res.json(analytics);
  } catch (error) {
    console.error('Failed to build DuckDB analytics overview.', error);
    return res.status(500).json({ message: 'Failed to build analytics overview.' });
  }
});

app.get('/api/admin/analytics/query', authRequired, adminRequired, analyticsRateLimit, async (req, res) => {
  if (!isDuckDbAvailable()) {
    return res.status(503).json({ message: 'Analytics is temporarily unavailable.' });
  }
  try {
    const analytics = await buildDuckDbOverview(req.query);
    return res.json(analytics);
  } catch (error) {
    console.error('Failed to run DuckDB analytics query.', error);
    return res.status(500).json({ message: 'Failed to run analytics query.' });
  }
});

app.get('/api/admin/analytics/parquet', authRequired, adminRequired, analyticsRateLimit, async (_, res) => {
  if (!isDuckDbAvailable()) {
    return res.status(503).json({ message: 'Analytics exports are temporarily unavailable.' });
  }
  try {
    return res.json({ datasets: listParquetDatasets() });
  } catch (error) {
    console.error('Failed to list Parquet datasets.', error);
    return res.status(500).json({ message: 'Failed to list Parquet datasets.' });
  }
});

app.get('/api/admin/analytics/parquet/:dataset', authRequired, adminRequired, analyticsRateLimit, async (req, res) => {
  if (!isDuckDbAvailable()) {
    return res.status(503).json({ message: 'Analytics exports are temporarily unavailable.' });
  }
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
    if (req.user?.sub && !req.user?.isAdmin) {
      const client = await pool.connect();
      try {
        const usage = await consumeDailyAiUsage(client, req.user);
        if (!usage.allowed) {
          await recordActivity('ai.daily_limit_reached', {
            userId: req.user.sub,
            limit: usage.limit
          });
          return res.status(429).json({
            message: `Daily AI limit reached. Non-admin accounts can use AI ${usage.limit} times per day.`
          });
        }
      } finally {
        client.release();
      }
    }

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
    await refreshUserWritingProfile(client, existing.rows[0].author_id);
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
    await refreshUserWritingProfile(client, existing.rows[0].author_id);
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

app.post('/api/posts/:postId/ai-rewrite', authRequired, async (req, res) => {
  if (!openAiPostRewriter.isEnabled()) {
    return res.status(503).json({ message: 'AI Rewrite is not configured for this server.' });
  }

  const instruction = String(req.body?.instruction || '').trim();
  if (!instruction) {
    return res.status(400).json({ message: 'A rewrite instruction is required.' });
  }

  const client = await pool.connect();
  try {
    const usage = await consumeDailyAiUsage(client, req.user);
    if (!usage.allowed) {
      await recordActivity('ai.daily_limit_reached', {
        userId: req.user.sub,
        limit: usage.limit
      });
      return res.status(429).json({
        message: `Daily AI limit reached. Non-admin accounts can use AI ${usage.limit} times per day.`
      });
    }

    const existing = await client.query(
      `SELECT p.id, p.author_id, p.section, p.title, p.content_markdown, p.created_at, p.updated_at,
              p.deleted_by_admin_at, p.deleted_by_admin_id, p.deleted_reason, p.appeal_requested_at, p.appeal_note, p.restored_at,
              u.username AS author_name, u.email AS author_email,
              COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
       FROM post p
       JOIN app_user u ON u.id = p.author_id
       LEFT JOIN post_tag pt ON pt.post_id = p.id
       LEFT JOIN tag t ON t.id = pt.tag_id
       WHERE p.id = $1
       GROUP BY p.id, u.username, u.email`,
      [req.params.postId]
    );

    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const post = mapPostRow(existing.rows[0]);
    if (post.authorId !== req.user.sub) {
      return res.status(403).json({ message: 'You can only rewrite your own posts.' });
    }
    if (post.moderation?.isDeleted) {
      return res.status(403).json({ message: 'This post is under moderation and cannot be rewritten.' });
    }

    const draftInput = req.body?.draft || {};
    const rewriteSource = {
      title: String(draftInput.title || post.title).trim(),
      content: String(draftInput.content || post.content).trim(),
      section: normalizeSection(draftInput.section || post.section) || post.section,
      tags: normalizeTags(Array.isArray(draftInput.tags) ? draftInput.tags : draftInput.tags || post.tags || [])
    };

    const { styleProfile } = await refreshUserWritingProfile(client, req.user.sub);
    const rewritten = await openAiPostRewriter.rewritePost({
      post: rewriteSource,
      instruction,
      styleProfile,
      currentUserName: req.user.name || ''
    });

    await recordActivity('post.ai_rewrite_requested', {
      userId: req.user.sub,
      postId: req.params.postId,
      instruction,
      provider: rewritten.provider,
      model: rewritten.model
    });

    return res.json({
      draft: rewritten.draft,
      generation: {
        mode: 'llm',
        provider: rewritten.provider,
        model: rewritten.model,
        fallback: false,
        rationale: rewritten.summary
      }
    });
  } catch (error) {
    console.error('Failed to rewrite post with AI.', error);
    return res.status(500).json({ message: 'Failed to rewrite post with AI.' });
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
    await refreshUserWritingProfile(client, req.user.sub);
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
    await refreshUserWritingProfile(client, req.user.sub);
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
    await refreshUserWritingProfile(client, req.user.sub);
    await recordActivity('post.deleted', {
      userId: req.user.sub,
      postId: req.params.postId
    });
    return res.json({ ok: true });
  } finally {
    client.release();
  }
});

runMigrations(pool, path.resolve(__dirname, '../migrations'))
  .then(async () => {
    await ensureMongoCollections().catch((error) => {
      console.error('MongoDB initialization failed. Continuing without MongoDB.', error);
    });

    const duckDbAvailable = await ensureDuckDbReady()
      .then(() => true)
      .catch((error) => {
        duckDb = null;
        duckDbReady = null;
        console.error('DuckDB initialization failed. Continuing without analytics.', error);
        return false;
      });

    const purged = await purgeExpiredModeratedPosts();
    if (purged > 0) {
      console.log(`Purged ${purged} expired moderated posts.`);
    }

    if (duckDbAvailable) {
      try {
        await buildDuckDbOverview();
        scheduleDailyAnalyticsRefresh();
      } catch (error) {
        duckDb = null;
        duckDbReady = null;
        console.error('Initial DuckDB analytics build failed. Continuing without analytics.', error);
      }
    }

    if (activityStore.isEnabled()) {
      console.log(`MongoDB connected to database "${activityStore.getDbName()}".`);
    } else {
      console.log('MongoDB not configured or unavailable. Continuing with PostgreSQL only.');
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
