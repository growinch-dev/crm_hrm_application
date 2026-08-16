const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requirePlatformAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requirePlatformAdmin);

const TENANT_SCHEMA_SQL = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', 'schema.sql'), 'utf8');

// Company logo uploads - same uploads dir/static route as documents.routes.js.
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const uploadLogo = multer({ storage: logoStorage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// Multipart form fields arrive as strings ("true"/"false") - this coerces the
// enabled_crm/hrm/accounts checkboxes back to real booleans, defaulting when absent.
function parseBool(value, fallback) {
  if (value === undefined) return fallback;
  return value === 'true' || value === true;
}

const DEFAULT_ROLES = [
  { name: 'admin', crm: true, hrm: true, accounts: true },
  { name: 'sales_manager', crm: true, hrm: false, accounts: false },
  { name: 'sales_rep', crm: true, hrm: false, accounts: false },
  { name: 'hr_manager', crm: false, hrm: true, accounts: false },
  { name: 'hr_exec', crm: false, hrm: true, accounts: false },
  { name: 'employee', crm: false, hrm: true, accounts: false },
];

function slugify(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Accepts a bare domain ("acme.com") or forgives a pasted full email ("jamie@acme.com")
// by keeping only the part after the last '@'. Rejects anything that still isn't a
// plausible domain afterward (must have a dot, no spaces/@ left).
function normalizeDomain(input) {
  const withoutEmailPrefix = String(input || '').trim().toLowerCase().split('@').pop();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(withoutEmailPrefix)) return null;
  return withoutEmailPrefix;
}

// Postgres identifiers: lowercase/underscores only, must start with a letter, capped well under the 63-byte limit.
function dbNameFromSlug(slug) {
  const safe = slug.replace(/-/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 50);
  return `tenant_${safe}`;
}

router.get('/organizations', async (req, res) => {
  try {
    const result = await db.controlPlanePool.query(`SELECT * FROM organizations ORDER BY created_at DESC`);
    const existing = await db.controlPlanePool.query(`SELECT datname FROM pg_database`);
    const existingNames = new Set(existing.rows.map((r) => r.datname));
    const data = result.rows.map((org) => ({ ...org, db_exists: existingNames.has(org.db_name) }));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch organizations', detail: err.message });
  }
});

router.post('/organizations', uploadLogo.single('logo'), async (req, res) => {
  try {
    const { name, email_domain, admin_name, admin_email, admin_password } = req.body;
    const enabled_crm = parseBool(req.body.enabled_crm, true);
    const enabled_hrm = parseBool(req.body.enabled_hrm, true);
    const enabled_accounts = parseBool(req.body.enabled_accounts, true);

    if (!name || !email_domain || !admin_name || !admin_email || !admin_password) {
      return res.status(400).json({ error: 'name, email_domain, admin_name, admin_email and admin_password are required' });
    }
    const domain = normalizeDomain(email_domain);
    if (!domain) return res.status(400).json({ error: 'Email domain must look like "acme.com" (not a full email address).' });

    const domainTaken = await db.controlPlanePool.query(`SELECT 1 FROM organizations WHERE email_domain = $1`, [domain]);
    if (domainTaken.rows.length > 0) return res.status(409).json({ error: 'A company with this email domain is already registered' });

    let slug = slugify(name);
    const slugTaken = await db.controlPlanePool.query(`SELECT 1 FROM organizations WHERE slug = $1`, [slug]);
    if (slugTaken.rows.length > 0) slug = `${slug}-${Date.now().toString(36)}`;
    const dbName = dbNameFromSlug(slug);

    // CREATE DATABASE cannot run inside a transaction block - must be its own standalone statement.
    await db.controlPlanePool.query(`CREATE DATABASE "${dbName}"`);

    // Apply the tenant schema, then seed default roles + the first admin login, in the new database.
    const tenantPool = db.getTenantPool(dbName);
    await tenantPool.query(TENANT_SCHEMA_SQL);

    let adminRoleId = null;
    for (const r of DEFAULT_ROLES) {
      const roleResult = await tenantPool.query(
        `INSERT INTO roles (name, can_access_crm, can_access_hrm, can_access_accounts) VALUES ($1,$2,$3,$4) RETURNING id`,
        [r.name, r.crm, r.hrm, r.accounts]
      );
      if (r.name === 'admin') adminRoleId = roleResult.rows[0].id;
    }

    const hash = await bcrypt.hash(admin_password, 10);
    await tenantPool.query(
      `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,$4)`,
      [admin_name, admin_email, hash, adminRoleId]
    );

    const logoPath = req.file ? `/uploads/${req.file.filename}` : null;

    // Only register the organization once its database is fully provisioned and seeded.
    const orgResult = await db.controlPlanePool.query(
      `INSERT INTO organizations (name, slug, email_domain, db_name, enabled_crm, enabled_hrm, enabled_accounts, logo_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, slug, domain, dbName, enabled_crm, enabled_hrm, enabled_accounts, logoPath]
    );

    res.status(201).json(orgResult.rows[0]);
  } catch (err) {
    console.error('organization onboarding error:', err.message);
    res.status(400).json({ error: 'Failed to create organization', detail: err.message });
  }
});

router.put('/organizations/:id', uploadLogo.single('logo'), async (req, res) => {
  try {
    const { name, email_domain, status } = req.body;
    const enabled_crm = req.body.enabled_crm !== undefined ? parseBool(req.body.enabled_crm) : undefined;
    const enabled_hrm = req.body.enabled_hrm !== undefined ? parseBool(req.body.enabled_hrm) : undefined;
    const enabled_accounts = req.body.enabled_accounts !== undefined ? parseBool(req.body.enabled_accounts) : undefined;

    let domain;
    if (email_domain !== undefined) {
      domain = normalizeDomain(email_domain);
      if (!domain) return res.status(400).json({ error: 'Email domain must look like "acme.com" (not a full email address).' });
      const domainTaken = await db.controlPlanePool.query(
        `SELECT 1 FROM organizations WHERE email_domain = $1 AND id != $2`,
        [domain, req.params.id]
      );
      if (domainTaken.rows.length > 0) return res.status(409).json({ error: 'Another company already uses this email domain' });
    }

    const fields = [];
    const values = [];
    if (name !== undefined) { values.push(name); fields.push(`name = $${values.length}`); }
    if (email_domain !== undefined) { values.push(domain); fields.push(`email_domain = $${values.length}`); }
    if (enabled_crm !== undefined) { values.push(enabled_crm); fields.push(`enabled_crm = $${values.length}`); }
    if (enabled_hrm !== undefined) { values.push(enabled_hrm); fields.push(`enabled_hrm = $${values.length}`); }
    if (enabled_accounts !== undefined) { values.push(enabled_accounts); fields.push(`enabled_accounts = $${values.length}`); }
    if (status !== undefined) { values.push(status); fields.push(`status = $${values.length}`); }
    if (req.file) { values.push(`/uploads/${req.file.filename}`); fields.push(`logo_path = $${values.length}`); }
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    values.push(req.params.id);
    const result = await db.controlPlanePool.query(`UPDATE organizations SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Organization not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update organization', detail: err.message });
  }
});

// Removes the organization record and, if its database still exists, drops it too
// (also cleans up rows left behind if the database was ever deleted out-of-band).
router.delete('/organizations/:id', async (req, res) => {
  try {
    const orgResult = await db.controlPlanePool.query(`SELECT * FROM organizations WHERE id = $1`, [req.params.id]);
    const org = orgResult.rows[0];
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    await db.controlPlanePool.query(`DELETE FROM organizations WHERE id = $1`, [req.params.id]);

    const dbExists = await db.controlPlanePool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [org.db_name]);
    if (dbExists.rows.length > 0) {
      await db.controlPlanePool.query(`DROP DATABASE "${org.db_name}"`);
    }

    res.json({ success: true, id: org.id });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete organization', detail: err.message });
  }
});

module.exports = router;
