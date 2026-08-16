const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate, requireEdit } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');
const { resolveOrgByEmail } = require('../utils/tenant');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    // Platform admins live in the control-plane DB and aren't tied to any company's email domain.
    const adminResult = await db.controlPlanePool.query(`SELECT * FROM platform_admins WHERE email = $1`, [email]);
    const admin = adminResult.rows[0];
    if (admin) {
      if (!admin.is_active) return res.status(401).json({ error: 'Invalid email or password' });
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

      const payload = { id: admin.id, email: admin.email, name: admin.name, is_platform_admin: true };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
      await db.controlPlanePool.query(`UPDATE platform_admins SET last_login_at = now() WHERE id = $1`, [admin.id]);
      return res.json({ token, user: payload });
    }

    // Otherwise resolve which company's database this email belongs to.
    const org = await resolveOrgByEmail(email);
    if (!org) return res.status(401).json({ error: 'Invalid email or password' });
    if (org.status === 'suspended') return res.status(403).json({ error: 'This organization has been suspended. Contact support.' });

    const tenantPool = db.getTenantPool(org.db_name);
    const result = await tenantPool.query(
      `SELECT u.*, r.name as role_name, r.can_access_crm, r.can_access_hrm, r.can_access_accounts, r.can_edit
       FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const payload = {
      id: user.id, email: user.email, name: user.name, role: user.role_name, employee_id: user.employee_id,
      can_access_crm: user.can_access_crm !== false, can_access_hrm: user.can_access_hrm !== false,
      can_access_accounts: user.can_access_accounts !== false, can_edit: user.can_edit !== false,
      organization_id: org.id, organization_name: org.name, organization_logo: org.logo_path || null, db_name: org.db_name,
      is_platform_admin: false,
      org_enabled_crm: org.enabled_crm !== false, org_enabled_hrm: org.enabled_hrm !== false,
      org_enabled_accounts: org.enabled_accounts !== false,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

    await tenantPool.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

    res.json({ token, user: payload });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const org = await resolveOrgByEmail(email);
    if (org && org.status !== 'suspended') {
      const tenantPool = db.getTenantPool(org.db_name);
      const result = await tenantPool.query(`SELECT id, name FROM users WHERE email = $1 AND is_active = true`, [email]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await tenantPool.query(
          `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)`,
          [user.id, tokenHash, expiresAt]
        );

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
        sendMail({
          to: email,
          subject: 'Reset your GrowInch password',
          html: `<p>Hi ${user.name},</p><p>Click the link below to reset your GrowInch CRM+HRM password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
        }).catch((err) => console.error('sendMail (forgot-password) failed:', err.message));
      }
    }

    // Always respond the same way, whether or not the email/company exists, to avoid leaking which emails are registered.
    res.json({ message: 'If that email exists, a password reset link has been sent.' });
  } catch (err) {
    console.error('forgot-password error:', err.message);
    res.status(500).json({ error: 'Failed to process request', detail: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, password } = req.body;
    if (!token || !email || !password) return res.status(400).json({ error: 'Token, email and new password are required' });

    const org = await resolveOrgByEmail(email);
    if (!org) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    const tenantPool = db.getTenantPool(org.db_name);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await tenantPool.query(
      `SELECT * FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });

    const record = result.rows[0];
    const hash = await bcrypt.hash(password, 10);
    await tenantPool.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [hash, record.user_id]);
    await tenantPool.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [record.id]);

    res.json({ message: 'Password reset successful. You can now sign in.' });
  } catch (err) {
    console.error('reset-password error:', err.message);
    res.status(500).json({ error: 'Failed to reset password', detail: err.message });
  }
});

// Creates a new login within the caller's own company database (used by Settings > Users).
// New-company onboarding is a separate, platform-admin-only flow (see platform.routes.js).
router.post('/register', authenticate, requireEdit, async (req, res) => {
  try {
    if (req.user.is_platform_admin) return res.status(400).json({ error: 'Platform admins cannot create company users directly.' });

    const { name, email, password, role = 'employee' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });

    const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'A user with this email already exists' });

    const roleResult = await db.query(`SELECT id FROM roles WHERE name = $1`, [role]);
    if (roleResult.rows.length === 0) return res.status(400).json({ error: `Unknown role: ${role}` });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,$4) RETURNING id, name, email`,
      [name, email, hash, roleResult.rows[0].id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
