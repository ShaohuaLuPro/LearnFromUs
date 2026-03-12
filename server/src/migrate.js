const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { runMigrations } = require('./lib/run-migrations');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('Missing DATABASE_URL in server environment.');
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    await runMigrations(pool, path.resolve(__dirname, '../migrations'));
    console.log('Database migrations applied.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration run failed.', error);
  process.exit(1);
});
