const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

router.use('/', buildCrudRouter({
  table: 'holidays',
  columns: ['name', 'date', 'type'],
  searchable: ['name'],
  defaultSort: 'date ASC',
}));

module.exports = router;
