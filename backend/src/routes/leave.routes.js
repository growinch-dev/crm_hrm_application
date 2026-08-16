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
  SELECT leave_requests.*, employees.first_name, employees.last_name, leave_types.name as leave_type_name, users.name as approved_by_name
  FROM leave_requests
  LEFT JOIN employees ON employees.id = leave_requests.employee_id
  LEFT JOIN leave_types ON leave_types.id = leave_requests.leave_type_id
  LEFT JOIN users ON users.id = leave_requests.approved_by`;

router.use('/', buildCrudRouter({
  table: 'leave_requests',
  columns: ['employee_id', 'leave_type_id', 'start_date', 'end_date', 'total_days', 'reason', 'status', 'approved_by'],
  searchable: ['reason'],
  selectSql,
  defaultSort: 'leave_requests.applied_at DESC',
}));

router.post('/:id/approve', requireEdit, async (req, res) => {
  try {
    const { approved_by } = req.body;
    const result = await db.query(
      `UPDATE leave_requests SET status = 'approved', approved_by = $1 WHERE id = $2 RETURNING *`,
      [approved_by || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Leave request not found' });
    res.json(result.rows[0]);
    notifyRequester(result.rows[0].employee_id, {
      type: 'leave_approved', title: 'Your leave request was approved', link: '/hrm/leave',
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to approve leave', detail: err.message });
  }
});

router.post('/:id/reject', requireEdit, async (req, res) => {
  try {
    const { approved_by } = req.body;
    const result = await db.query(
      `UPDATE leave_requests SET status = 'rejected', approved_by = $1 WHERE id = $2 RETURNING *`,
      [approved_by || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Leave request not found' });
    res.json(result.rows[0]);
    notifyRequester(result.rows[0].employee_id, {
      type: 'leave_rejected', title: 'Your leave request was rejected', link: '/hrm/leave',
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to reject leave', detail: err.message });
  }
});

module.exports = router;
