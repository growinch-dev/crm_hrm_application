const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const baseConfig = {
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
};

const DEMO_TENANT_DB = `${process.env.PGDATABASE}_demo`;

async function applySchema(database, sqlFile, label) {
  const pool = new Pool({ ...baseConfig, database });
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', sqlFile), 'utf8');
  console.log(`Running ${label} migration against ${database}@${process.env.PGHOST}:${process.env.PGPORT} ...`);
  try {
    await pool.query(sql);
    console.log(`✅ ${label} schema created successfully.`);
  } finally {
    await pool.end();
  }
}

async function ensureDatabaseExists(dbName) {
  const pool = new Pool({ ...baseConfig, database: process.env.PGDATABASE });
  try {
    const exists = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rows.length === 0) {
      await pool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created database ${dbName}`);
    }
  } finally {
    await pool.end();
  }
}

async function migrate() {
  try {
    // 1. Control-plane database: organizations + platform admins.
    await applySchema(process.env.PGDATABASE, 'control-plane-schema.sql', 'control-plane');

    // 2. One demo tenant database, for local dev/testing (npm run seed populates it).
    await ensureDatabaseExists(DEMO_TENANT_DB);
    await applySchema(DEMO_TENANT_DB, 'schema.sql', 'demo tenant');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  }
}

migrate();
