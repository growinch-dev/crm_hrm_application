const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

// One Postgres server, many databases: `controlPlanePool` talks to the platform's
// own database (organizations, platform_admins). Every onboarded company gets its
// own separate database, connected to lazily via `getTenantPool` and cached for
// the life of the process.
const baseConfig = {
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
};

const controlPlanePool = new Pool({ ...baseConfig, database: process.env.PGDATABASE });
controlPlanePool.on('error', (err) => console.error('Unexpected error on idle Postgres client (control plane)', err));

const tenantPools = new Map();
function getTenantPool(dbName) {
  if (!tenantPools.has(dbName)) {
    const pool = new Pool({ ...baseConfig, database: dbName });
    pool.on('error', (err) => console.error(`Unexpected error on idle Postgres client (tenant ${dbName})`, err));
    tenantPools.set(dbName, pool);
  }
  return tenantPools.get(dbName);
}

// Every request picks its tenant's pool once (in middleware/auth.js, right after
// verifying the JWT) and everything downstream - every route file's plain
// `db.query(...)` / `db.pool.connect()` - transparently uses that same pool for
// the rest of the request, with zero changes needed in those route files.
const als = new AsyncLocalStorage();
function runWithTenant(dbName, fn) {
  return als.run(dbName ? getTenantPool(dbName) : controlPlanePool, fn);
}

module.exports = {
  query: (text, params) => (als.getStore() || controlPlanePool).query(text, params),
  get pool() { return als.getStore() || controlPlanePool; },
  controlPlanePool,
  getTenantPool,
  runWithTenant,
};
