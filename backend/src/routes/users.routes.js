const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireEdit } = require('../middleware/auth');

const router = express.Router();

const selectSql = `SELECT users.id, users.name, users.email, users.is_active, users.employee_id, users.last_login_at, users.created_at, roles.name as role_name, roles.id as role_id
  FROM users LEFT JOIN roles ON roles.id = users.role_id`;

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`${selectSql} ORDER BY users.name ASC`);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`${selectSql} WHERE users.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user', detail: err.message });
  }
});

router.put('/:id', requireEdit, async (req, res) => {
  try {
    const { name, role_id, is_active, password } = req.body;
    const fields = [];
    const values = [];
    if (name !== undefined) { values.push(name); fields.push(`name = $${values.length}`); }
    if (role_id !== undefined) { values.push(role_id); fields.push(`role_id = $${values.length}`); }
    if (is_active !== undefined) { values.push(is_active); fields.push(`is_active = $${values.length}`); }
    if (password) { values.push(await bcrypt.hash(password, 10)); fields.push(`password_hash = $${values.length}`); }
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    values.push(req.params.id);
    await db.query(`UPDATE users SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
    const result = await db.query(`${selectSql} WHERE users.id = $1`, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update user', detail: err.message });
  }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete user', detail: err.message });
  }
});

module.exports = router;
