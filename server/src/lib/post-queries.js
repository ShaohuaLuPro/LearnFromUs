function parseSections(input) {
  const raw = Array.isArray(input) ? input.join(',') : String(input || '');
  return [...new Set(
    raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  )].slice(0, 8);
}

function parsePostListFilters(input = {}) {
  const rawPageSize = String(input.pageSize || '').trim().toLowerCase();
  const isAll = rawPageSize === 'all';
  const page = isAll ? 1 : Math.max(1, Math.trunc(Number(input.page) || 1));
  const pageSize = isAll
    ? 'all'
    : Math.min(20, Math.max(1, Math.trunc(Number(input.pageSize) || 10)));
  const query = String(input.q || '').trim();
  const sections = parseSections(input.section);
  return {
    page,
    pageSize,
    offset: pageSize === 'all' ? 0 : (page - 1) * pageSize,
    query,
    sections
  };
}

function buildPublicPostsWhere(filters) {
  const clauses = [
    'p.is_published = TRUE',
    'p.deleted_by_admin_at IS NULL'
  ];
  const params = [];

  if (filters.sections.length > 0) {
    params.push(filters.sections);
    clauses.push(`p.section = ANY($${params.length}::text[])`);
  }

  if (filters.query) {
    params.push(`%${filters.query}%`);
    const index = params.length;
    clauses.push(`(
      p.title ILIKE $${index}
      OR p.content_markdown ILIKE $${index}
      OR u.username ILIKE $${index}
      OR EXISTS (
        SELECT 1
        FROM post_tag pt2
        JOIN tag t2 ON t2.id = pt2.tag_id
        WHERE pt2.post_id = p.id
          AND t2.name ILIKE $${index}
      )
    )`);
  }

  return {
    whereSql: clauses.join('\n       AND '),
    params
  };
}

async function listPublicPosts(pool, mapPostRow, filtersInput = {}) {
  const filters = parsePostListFilters(filtersInput);
  const { whereSql, params } = buildPublicPostsWhere(filters);
  const client = await pool.connect();

  try {
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM post p
       JOIN app_user u ON u.id = p.author_id
       WHERE ${whereSql}`,
      params
    );

    const queryParams = [...params];
    let limitOffsetSql = '';
    if (filters.pageSize !== 'all') {
      queryParams.push(filters.pageSize, filters.offset);
      const limitIndex = queryParams.length - 1;
      const offsetIndex = queryParams.length;
      limitOffsetSql = `\n       LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
    }

    const result = await client.query(
      `SELECT p.id, p.author_id, p.section, p.title, p.content_markdown, p.created_at, p.updated_at,
              p.deleted_by_admin_at, p.deleted_by_admin_id, p.deleted_reason, p.appeal_requested_at, p.appeal_note, p.restored_at,
              u.username AS author_name, u.email AS author_email,
              COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
       FROM post p
       JOIN app_user u ON u.id = p.author_id
       LEFT JOIN post_tag pt ON pt.post_id = p.id
       LEFT JOIN tag t ON t.id = pt.tag_id
       WHERE ${whereSql}
       GROUP BY p.id, u.username, u.email
       ORDER BY p.created_at DESC${limitOffsetSql}`,
      queryParams
    );

    const total = countResult.rows[0]?.count || 0;
    const totalPages = filters.pageSize === 'all'
      ? 1
      : Math.max(1, Math.ceil(total / filters.pageSize));
    return {
      posts: result.rows.map(mapPostRow),
      pagination: {
        page: filters.pageSize === 'all' ? 1 : filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages
      },
      filters: {
        q: filters.query,
        section: filters.sections
      }
    };
  } finally {
    client.release();
  }
}

async function getPublicPostById(pool, mapPostRow, postId) {
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
       WHERE p.id = $1
         AND p.is_published = TRUE
         AND p.deleted_by_admin_at IS NULL
       GROUP BY p.id, u.username, u.email`,
      [postId]
    );

    return result.rows[0] ? mapPostRow(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

module.exports = {
  listPublicPosts,
  getPublicPostById
};
