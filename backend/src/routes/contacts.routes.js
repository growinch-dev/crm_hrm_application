const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const selectSql = `
  SELECT contacts.*, companies.name as company_name, users.name as owner_name
  FROM contacts
  LEFT JOIN companies ON companies.id = contacts.company_id
  LEFT JOIN users ON users.id = contacts.owner_id`;

router.use('/', buildCrudRouter({
  table: 'contacts',
  columns: ['company_id', 'first_name', 'last_name', 'email', 'phone', 'designation', 'department', 'is_primary', 'owner_id', 'notes'],
  searchable: ['first_name', 'last_name', 'email', 'phone'],
  selectSql,
  defaultSort: 'contacts.created_at DESC',
}));

module.exports = router;
