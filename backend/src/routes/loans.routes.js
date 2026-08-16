const express = require('express');
const db = require('../db');
const { buildCrudRouter } = require('../utils/crudFactory');
const { requireEdit } = require('../middleware/auth');
const { createNotification } = require('../utils/notify');

const router = express.Router();

async function notifyRequester(employeeId, { type, title, body, link }) {
  if (!employeeId) return;
  const result = await db.query(`SELECT id FROM users WHERE employee_id = $1`, [employeeId]);
  const requesterUser = result.rows[0];
  if (requesterUser) createNotification({ userId: requesterUser.id, type, title, body, link, sendEmail: true });
}

const selectSql = `
  SELECT loan_requests.*, employees.first_name, employees.last_name, employees.employee_code, users.name as approved_by_name
  FROM loan_requests
  LEFT JOIN employees ON employees.id = loan_requests.employee_id
  LEFT JOIN users ON users.id = loan_requests.approved_by`;

router.use('/', buildCrudRouter({
  table: 'loan_requests',
  columns: ['employee_id', 'loan_type', 'amount', 'reason', 'requested_date', 'monthly_deduction', 'status', 'approved_by', 'disbursed_date', 'outstanding_balance'],
  searchable: ['reason'],
  selectSql,
  defaultSort: 'loan_requests.requested_date DESC',
}));

router.post('/:id/approve', requireEdit, async (req, res) => {
  try {
    const { approved_by } = req.body;
    const result = await db.query(
      `UPDATE loan_requests SET status = 'approved', approved_by = $1 WHERE id = $2 RETURNING *`,
      [approved_by || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Loan request not found' });
    res.json(result.rows[0]);
    notifyRequester(result.rows[0].employee_id, {
      type: 'loan_approved', title: 'Your loan/advance request was approved', link: '/hrm/loans',
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to approve loan request', detail: err.message });
  }
});

router.post('/:id/reject', requireEdit, async (req, res) => {
  try {
    const { approved_by } = req.body;
    const result = await db.query(
      `UPDATE loan_requests SET status = 'rejected', approved_by = $1 WHERE id = $2 RETURNING *`,
      [approved_by || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Loan request not found' });
    res.json(result.rows[0]);
    notifyRequester(result.rows[0].employee_id, {
      type: 'loan_rejected', title: 'Your loan/advance request was rejected', link: '/hrm/loans',
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to reject loan request', detail: err.message });
  }
});

module.exports = router;
