const express = require('express');
const db = require('../db');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const selectSql = `
  SELECT offboarding.*, employees.first_name, employees.last_name, employees.employee_code
  FROM offboarding LEFT JOIN employees ON employees.id = offboarding.employee_id`;

const crud = buildCrudRouter({
  table: 'offboarding',
  columns: ['employee_id', 'resignation_date', 'last_working_day', 'reason', 'status', 'exit_interview_notes', 'clearance_it', 'clearance_finance', 'clearance_assets'],
  searchable: ['reason'],
  selectSql,
  defaultSort: 'offboarding.created_at DESC',
});

// when offboarding completes, mark the employee as exited
router.put('/:id', async (req, res, next) => {
  if (req.body.status === 'completed') {
    try {
      const record = await db.query('SELECT employee_id FROM offboarding WHERE id = $1', [req.params.id]);
      if (record.rows[0]) {
        await db.query(`UPDATE employees SET status = 'exited', updated_at = now() WHERE id = $1`, [record.rows[0].employee_id]);
      }
    } catch (err) {
      console.error('offboarding -> employee status sync failed:', err.message);
    }
  }
  next();
});

router.use('/', crud);

module.exports = router;
