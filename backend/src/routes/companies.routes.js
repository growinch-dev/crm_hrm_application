const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const selectSql = `
  SELECT companies.*, users.name as owner_name
  FROM companies
  LEFT JOIN users ON users.id = companies.owner_id`;

router.use('/', buildCrudRouter({
  table: 'companies',
  columns: ['name', 'industry', 'website', 'phone', 'email', 'billing_address', 'shipping_address', 'city', 'state', 'country', 'annual_revenue', 'employee_count', 'owner_id', 'notes'],
  searchable: ['name', 'industry', 'email', 'city'],
  selectSql,
  defaultSort: 'companies.created_at DESC',
}));

module.exports = router;
