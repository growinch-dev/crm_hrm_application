const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

router.use('/roles', buildCrudRouter({
  table: 'roles', columns: ['name', 'description', 'can_access_crm', 'can_access_hrm', 'can_access_accounts', 'can_edit'], searchable: ['name'], defaultSort: 'id ASC',
}));

router.use('/lead-sources', buildCrudRouter({
  table: 'lead_sources', columns: ['name'], searchable: ['name'], defaultSort: 'id ASC',
}));

router.use('/pipeline-stages', buildCrudRouter({
  table: 'pipeline_stages', columns: ['name', 'sequence', 'probability', 'is_won', 'is_lost'], searchable: ['name'], defaultSort: 'sequence ASC',
}));

router.use('/departments', buildCrudRouter({
  table: 'departments',
  columns: ['name', 'parent_id', 'head_employee_id'],
  searchable: ['name'],
  defaultSort: 'name ASC',
}));

router.use('/designations', buildCrudRouter({
  table: 'designations',
  columns: ['title', 'department_id', 'grade_level'],
  searchable: ['title'],
  selectSql: `SELECT designations.*, departments.name as department_name FROM designations LEFT JOIN departments ON departments.id = designations.department_id`,
  defaultSort: 'designations.title ASC',
}));

router.use('/leave-types', buildCrudRouter({
  table: 'leave_types', columns: ['name', 'days_allowed', 'is_paid'], searchable: ['name'], defaultSort: 'id ASC',
}));

module.exports = router;
