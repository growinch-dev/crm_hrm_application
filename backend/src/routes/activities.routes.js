const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const selectSql = `
  SELECT activities.*, users.name as assigned_to_name
  FROM activities
  LEFT JOIN users ON users.id = activities.assigned_to`;

router.use('/', buildCrudRouter({
  table: 'activities',
  columns: ['type', 'subject', 'related_to_type', 'related_to_id', 'due_date', 'status', 'priority', 'assigned_to', 'notes'],
  searchable: ['subject'],
  selectSql,
  defaultSort: 'activities.due_date ASC NULLS LAST',
}));

module.exports = router;
