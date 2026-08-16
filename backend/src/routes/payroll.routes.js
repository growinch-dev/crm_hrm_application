const express = require('express');
const db = require('../db');
const { buildCrudRouter } = require('../utils/crudFactory');
const { requireEdit } = require('../middleware/auth');

const router = express.Router();

router.use('/runs', buildCrudRouter({
  table: 'payroll_runs',
  columns: ['month', 'year', 'status', 'processed_at'],
  searchable: [],
  defaultSort: 'year DESC, month DESC',
}));

const payslipSelectSql = `
  SELECT payslips.*, employees.first_name, employees.last_name, employees.employee_code
  FROM payslips LEFT JOIN employees ON employees.id = payslips.employee_id`;

router.use('/payslips', buildCrudRouter({
  table: 'payslips',
  columns: ['payroll_run_id', 'employee_id', 'basic_salary', 'allowances', 'deductions', 'tax', 'net_pay', 'status', 'paid_at'],
  searchable: [],
  selectSql: payslipSelectSql,
  defaultSort: 'payslips.id DESC',
}));

// Generate payslips for every active employee for a given payroll run,
// using a simple CTC/12 basic split (30% allowances, 10% tax) as a starting estimate.
router.post('/runs/:id/generate', requireEdit, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const runResult = await client.query('SELECT * FROM payroll_runs WHERE id = $1', [req.params.id]);
    if (runResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Payroll run not found' }); }

    const employees = await client.query(`SELECT * FROM employees WHERE status = 'active'`);
    await client.query('DELETE FROM payslips WHERE payroll_run_id = $1', [req.params.id]);

    const payslips = [];
    for (const emp of employees.rows) {
      const monthlyCtc = Number(emp.ctc_annual || 0) / 12;
      const basic = monthlyCtc * 0.5;
      const allowances = monthlyCtc * 0.3;
      const tax = monthlyCtc * 0.1;
      const deductions = tax;
      const netPay = basic + allowances - deductions;

      const result = await client.query(
        `INSERT INTO payslips (payroll_run_id, employee_id, basic_salary, allowances, deductions, tax, net_pay, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
        [req.params.id, emp.id, basic, allowances, deductions, tax, netPay]
      );
      payslips.push(result.rows[0]);
    }

    await client.query(`UPDATE payroll_runs SET status = 'processed', processed_at = now() WHERE id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ generated: payslips.length, payslips });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Failed to generate payroll', detail: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
