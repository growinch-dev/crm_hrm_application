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

const DEMO_TENANT_SCHEMA = 'tenant_demo';

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

async function applyDemoTenantSchema() {
  const pool = new Pool({ ...baseConfig, database: process.env.PGDATABASE });
  const client = await pool.connect();
  try {
    console.log(`Provisioning demo tenant schema "${DEMO_TENANT_SCHEMA}" in ${process.env.PGDATABASE}@${process.env.PGHOST}:${process.env.PGPORT} ...`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${DEMO_TENANT_SCHEMA}"`);
    await client.query(`SET search_path TO "${DEMO_TENANT_SCHEMA}", public`);
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', 'schema.sql'), 'utf8');
    await client.query(sql);
    console.log(`✅ demo tenant schema created successfully.`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function migrate() {
  try {
    // 1. Control-plane: organizations + platform admins, in "public".
    await applySchema(process.env.PGDATABASE, 'control-plane-schema.sql', 'control-plane');

    // 2. One demo tenant schema, for local dev/testing (npm run seed populates it).
    await applyDemoTenantSchema();
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  }
}

migrate();
