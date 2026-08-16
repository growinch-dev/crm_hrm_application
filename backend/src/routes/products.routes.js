const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

router.use('/', buildCrudRouter({
  table: 'products',
  columns: ['name', 'sku', 'type', 'category', 'unit_price', 'tax_percent', 'description', 'is_active'],
  searchable: ['name', 'sku', 'category'],
  defaultSort: 'created_at DESC',
}));

module.exports = router;
