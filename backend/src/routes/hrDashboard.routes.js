const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/summary', async (req, res) => {
  try {
    const [
      totalEmployees, activeEmployees, openPositions, pendingLeaves,
      todayAttendance, pendingExpenses, employeesByDept, leavesByStatus, upcomingHolidays,
    ] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM employees`),
      db.query(`SELECT COUNT(*) FROM employees WHERE status = 'active'`),
      db.query(`SELECT COALESCE(SUM(openings_count),0) as total FROM job_openings WHERE status = 'open'`),
      db.query(`SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'`),
      db.query(`SELECT COUNT(*) FROM attendance WHERE date = CURRENT_DATE AND status = 'present'`),
      db.query(`SELECT COUNT(*) FROM expense_claims WHERE status = 'pending'`),
      db.query(`SELECT departments.name as department, COUNT(employees.id) as count
                 FROM departments LEFT JOIN employees ON employees.department_id = departments.id
                 GROUP BY departments.name`),
      db.query(`SELECT status, COUNT(*) as count FROM leave_requests GROUP BY status`),
      db.query(`SELECT * FROM holidays WHERE date >= CURRENT_DATE ORDER BY date ASC LIMIT 5`),
    ]);

    res.json({
      totalEmployees: parseInt(totalEmployees.rows[0].count, 10),
      activeEmployees: parseInt(activeEmployees.rows[0].count, 10),
      openPositions: parseInt(openPositions.rows[0].total, 10),
      pendingLeaves: parseInt(pendingLeaves.rows[0].count, 10),
      presentToday: parseInt(todayAttendance.rows[0].count, 10),
      pendingExpenses: parseInt(pendingExpenses.rows[0].count, 10),
      employeesByDept: employeesByDept.rows,
      leavesByStatus: leavesByStatus.rows,
      upcomingHolidays: upcomingHolidays.rows,
    });
  } catch (err) {
    console.error('hr dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to load HR dashboard', detail: err.message });
  }
});

module.exports = router;
