const express = require('express');
const db = require('../db');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const selectSql = `
  SELECT assets.*, employees.first_name, employees.last_name
  FROM assets LEFT JOIN employees ON employees.id = assets.assigned_to`;

router.use('/', buildCrudRouter({
  table: 'assets',
  columns: ['asset_tag', 'name', 'category', 'serial_number', 'purchase_date', 'purchase_cost', 'status', 'assigned_to', 'assigned_at'],
  searchable: ['asset_tag', 'name', 'serial_number'],
  selectSql,
  defaultSort: 'assets.created_at DESC',
}));

router.post('/:id/assign', async (req, res) => {
  try {
    const { employee_id } = req.body;
    const result = await db.query(
      `UPDATE assets SET assigned_to = $1, status = 'assigned', assigned_at = now() WHERE id = $2 RETURNING *`,
      [employee_id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Failed to assign asset', detail: err.message });
  }
});

router.post('/:id/return', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE assets SET assigned_to = NULL, status = 'available', assigned_at = NULL WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Failed to return asset', detail: err.message });
  }
});

module.exports = router;
