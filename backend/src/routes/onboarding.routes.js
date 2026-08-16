const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const selectSql = `
  SELECT onboarding_tasks.*, employees.first_name, employees.last_name, users.name as assigned_to_name
  FROM onboarding_tasks
  LEFT JOIN employees ON employees.id = onboarding_tasks.employee_id
  LEFT JOIN users ON users.id = onboarding_tasks.assigned_to`;

router.use('/', buildCrudRouter({
  table: 'onboarding_tasks',
  columns: ['employee_id', 'task_name', 'category', 'status', 'due_date', 'assigned_to'],
  searchable: ['task_name'],
  selectSql,
  defaultSort: 'onboarding_tasks.due_date ASC NULLS LAST',
}));

module.exports = router;
