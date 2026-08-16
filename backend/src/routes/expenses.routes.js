const express = require('express');
const db = require('../db');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const selectSql = `
  SELECT expense_claims.*, employees.first_name, employees.last_name, users.name as approved_by_name
  FROM expense_claims
  LEFT JOIN employees ON employees.id = expense_claims.employee_id
  LEFT JOIN users ON users.id = expense_claims.approved_by`;

router.use('/', buildCrudRouter({
  table: 'expense_claims',
  columns: ['employee_id', 'category', 'amount', 'expense_date', 'description', 'receipt_path', 'status', 'approved_by'],
  searchable: ['category', 'description'],
  selectSql,
  defaultSort: 'expense_claims.submitted_at DESC',
}));

router.post('/:id/approve', async (req, res) => {
  try {
    const { approved_by } = req.body;
    const result = await db.query(`UPDATE expense_claims SET status = 'approved', approved_by = $1 WHERE id = $2 RETURNING *`, [approved_by || null, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Expense claim not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Failed to approve expense', detail: err.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { approved_by } = req.body;
    const result = await db.query(`UPDATE expense_claims SET status = 'rejected', approved_by = $1 WHERE id = $2 RETURNING *`, [approved_by || null, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Expense claim not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Failed to reject expense', detail: err.message });
  }
});

module.exports = router;
