const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const selectSql = `
  SELECT attendance.*, employees.first_name, employees.last_name, employees.employee_code
  FROM attendance
  LEFT JOIN employees ON employees.id = attendance.employee_id`;

router.use('/', buildCrudRouter({
  table: 'attendance',
  columns: ['employee_id', 'date', 'check_in', 'check_out', 'status', 'work_hours', 'notes'],
  searchable: [],
  selectSql,
  defaultSort: 'attendance.date DESC',
}));

module.exports = router;
