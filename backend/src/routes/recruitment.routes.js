const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const jobSelectSql = `
  SELECT job_openings.*, departments.name as department_name
  FROM job_openings LEFT JOIN departments ON departments.id = job_openings.department_id`;

router.use('/job-openings', buildCrudRouter({
  table: 'job_openings',
  columns: ['title', 'department_id', 'employment_type', 'openings_count', 'status', 'description', 'posted_date'],
  searchable: ['title'],
  selectSql: jobSelectSql,
  defaultSort: 'job_openings.created_at DESC',
}));

const candidateSelectSql = `
  SELECT candidates.*, job_openings.title as job_title
  FROM candidates LEFT JOIN job_openings ON job_openings.id = candidates.job_opening_id`;

router.use('/candidates', buildCrudRouter({
  table: 'candidates',
  columns: ['job_opening_id', 'name', 'email', 'phone', 'resume_path', 'stage', 'source', 'notes'],
  searchable: ['name', 'email'],
  selectSql: candidateSelectSql,
  defaultSort: 'candidates.created_at DESC',
}));

module.exports = router;
