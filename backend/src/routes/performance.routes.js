const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const reviewSelectSql = `
  SELECT performance_reviews.*, employees.first_name, employees.last_name, users.name as reviewer_name
  FROM performance_reviews
  LEFT JOIN employees ON employees.id = performance_reviews.employee_id
  LEFT JOIN users ON users.id = performance_reviews.reviewer_id`;

router.use('/reviews', buildCrudRouter({
  table: 'performance_reviews',
  columns: ['employee_id', 'reviewer_id', 'review_period', 'rating', 'strengths', 'improvements', 'status'],
  searchable: ['review_period'],
  selectSql: reviewSelectSql,
  defaultSort: 'performance_reviews.created_at DESC',
}));

const goalSelectSql = `
  SELECT goals.*, employees.first_name, employees.last_name
  FROM goals LEFT JOIN employees ON employees.id = goals.employee_id`;

router.use('/goals', buildCrudRouter({
  table: 'goals',
  columns: ['employee_id', 'title', 'description', 'target_date', 'progress', 'status'],
  searchable: ['title'],
  selectSql: goalSelectSql,
  defaultSort: 'goals.created_at DESC',
}));

module.exports = router;
