const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

// One Postgres database, many schemas: every onboarded company gets its own
// Postgres schema (not a separate database - Supabase projects are effectively
// single-database) inside this one shared pool. Which schema a request targets
// is tracked per-request via AsyncLocalStorage and applied with `SET search_path`
// on whichever connection actually services that request's queries.
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: Number(process.env.PGPOOL_MAX) || 20,
});
pool.on('error', (err) => console.error('Unexpected error on idle Postgres client', err));

const als = new AsyncLocalStorage();

// Borrows a client, pins its search_path to the given schema (or just "public"
// for platform-admin/control-plane work), runs fn, and ALWAYS resets search_path
// back to "public" before releasing - so an idle connection handed back to the
// pool can never leak a stale tenant search_path into someone else's query.
async function withSchema(schemaName, fn) {
  const client = await pool.connect();
  try {
    await client.query(schemaName ? `SET search_path TO "${schemaName}", public` : 'SET search_path TO public');
    return await fn(client);
  } finally {
    await client.query('SET search_path TO public').catch(() => {});
    client.release();
  }
}

// Same idea, but for the existing `db.pool.connect()` transaction pattern used
// by several route files (BEGIN/COMMIT/ROLLBACK across multiple statements) -
// sets search_path once right after checkout, and makes the route's normal
// client.release() call reset search_path before actually releasing.
async function connectScoped() {
  const schemaName = als.getStore();
  const client = await pool.connect();
  try {
    await client.query(schemaName ? `SET search_path TO "${schemaName}", public` : 'SET search_path TO public');
  } catch (err) {
    client.release(err);
    throw err;
  }
  const realRelease = client.release.bind(client);
  client.release = (err) => {
    client.query('SET search_path TO public').catch(() => {}).finally(() => realRelease(err));
  };
  return client;
}

// Every request picks its tenant's schema once (in middleware/auth.js, right
// after verifying the JWT) and everything downstream - every route file's plain
// `db.query(...)` / `db.pool.connect()` - transparently scopes to that schema
// for the rest of the request, with zero changes needed in those route files.
function runWithTenant(schemaName, fn) {
  return als.run(schemaName || null, fn);
}

module.exports = {
  query: (text, params) => withSchema(als.getStore(), (client) => client.query(text, params)),
  get pool() { return { connect: connectScoped }; },
  controlPlanePool: {
    query: (text, params) => withSchema(null, (client) => client.query(text, params)),
    // Raw client, no preset search_path - used only by org provisioning, which
    // must CREATE SCHEMA before it can SET search_path to it.
    connect: () => pool.connect(),
  },
  withSchema,
  runWithTenant,
};
