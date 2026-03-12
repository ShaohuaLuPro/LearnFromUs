const fs = require('fs/promises');
const path = require('path');

async function runMigrations(pool, migrationsDir) {
  await fs.mkdir(migrationsDir, { recursive: true });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migration (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const migrationClient = await pool.connect();
    try {
      const existing = await migrationClient.query(
        `SELECT 1 FROM schema_migration WHERE file_name = $1`,
        [file]
      );
      if (existing.rows[0]) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await migrationClient.query('BEGIN');
      await migrationClient.query(sql);
      await migrationClient.query(
        `INSERT INTO schema_migration (file_name) VALUES ($1)`,
        [file]
      );
      await migrationClient.query('COMMIT');
    } catch (error) {
      await migrationClient.query('ROLLBACK');
      throw error;
    } finally {
      migrationClient.release();
    }
  }
}

module.exports = {
  runMigrations
};
