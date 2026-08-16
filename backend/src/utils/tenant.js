const db = require('../db');

// Resolves which company's database an email belongs to, by matching the part
// after '@' against the email_domain registered for that company at onboarding.
async function resolveOrgByEmail(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase();
  if (!domain) return null;
  const result = await db.controlPlanePool.query(`SELECT * FROM organizations WHERE email_domain = $1`, [domain]);
  return result.rows[0] || null;
}

module.exports = { resolveOrgByEmail };
