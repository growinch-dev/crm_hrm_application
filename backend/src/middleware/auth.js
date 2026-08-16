const jwt = require('jsonwebtoken');
const db = require('../db');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role, employee_id, db_name, is_platform_admin, ... }
    // Routes downstream of this middleware just call db.query(...) as normal -
    // this picks which company's database that resolves to for the rest of the
    // request. Platform admins have no db_name and fall back to the control-plane DB.
    db.runWithTenant(payload.db_name, next);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Usage: authorize('admin', 'hr_manager')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (allowedRoles.length === 0) return next();
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    next();
  };
}

function requirePlatformAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.user.is_platform_admin) {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  next();
}

// View-only roles (roles.can_edit = false) can list/view everything but never mutate.
// Applied automatically to every buildCrudRouter POST/PUT/DELETE, and available here
// for custom route files (quotations, invoices, tickets, ...) to apply the same rule.
function requireEdit(req, res, next) {
  if (req.user && req.user.can_edit === false) {
    return res.status(403).json({ error: 'Your role has view-only access.' });
  }
  next();
}

module.exports = { authenticate, authorize, requirePlatformAdmin, requireEdit };
