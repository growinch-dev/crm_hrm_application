const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

router.use('/programs', buildCrudRouter({
  table: 'trainings',
  columns: ['title', 'description', 'trainer', 'start_date', 'end_date', 'status'],
  searchable: ['title', 'trainer'],
  defaultSort: 'start_date DESC',
}));

const enrollmentSelectSql = `
  SELECT training_enrollments.*, trainings.title as training_title, employees.first_name, employees.last_name
  FROM training_enrollments
  LEFT JOIN trainings ON trainings.id = training_enrollments.training_id
  LEFT JOIN employees ON employees.id = training_enrollments.employee_id`;

router.use('/enrollments', buildCrudRouter({
  table: 'training_enrollments',
  columns: ['training_id', 'employee_id', 'status', 'score'],
  searchable: [],
  selectSql: enrollmentSelectSql,
  defaultSort: 'training_enrollments.id DESC',
}));

module.exports = router;
