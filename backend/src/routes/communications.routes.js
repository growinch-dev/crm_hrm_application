const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const selectSql = `
  SELECT communications.*, contacts.first_name as contact_first_name, contacts.last_name as contact_last_name, users.name as logged_by_name
  FROM communications
  LEFT JOIN contacts ON contacts.id = communications.contact_id
  LEFT JOIN users ON users.id = communications.logged_by`;

router.use('/', buildCrudRouter({
  table: 'communications',
  columns: ['type', 'direction', 'related_to_type', 'related_to_id', 'subject', 'body', 'contact_id', 'logged_by'],
  searchable: ['subject', 'body'],
  selectSql,
  defaultSort: 'communications.occurred_at DESC',
}));

module.exports = router;
