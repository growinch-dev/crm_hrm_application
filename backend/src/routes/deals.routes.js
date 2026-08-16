const express = require('express');
const db = require('../db');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const selectSql = `
  SELECT deals.*, companies.name as company_name, contacts.first_name as contact_first_name,
         contacts.last_name as contact_last_name, pipeline_stages.name as stage_name,
         pipeline_stages.sequence as stage_sequence, users.name as owner_name
  FROM deals
  LEFT JOIN companies ON companies.id = deals.company_id
  LEFT JOIN contacts ON contacts.id = deals.contact_id
  LEFT JOIN pipeline_stages ON pipeline_stages.id = deals.stage_id
  LEFT JOIN users ON users.id = deals.owner_id`;

router.use('/', buildCrudRouter({
  table: 'deals',
  columns: ['name', 'company_id', 'contact_id', 'stage_id', 'amount', 'probability', 'expected_close_date', 'status', 'lost_reason', 'owner_id'],
  searchable: ['name'],
  selectSql,
  defaultSort: 'deals.created_at DESC',
}));

// Kanban board view: deals grouped by pipeline stage
router.get('/view/pipeline', async (req, res) => {
  try {
    const stages = await db.query('SELECT * FROM pipeline_stages ORDER BY sequence ASC');
    const deals = await db.query(`${selectSql} WHERE deals.status = 'open' ORDER BY deals.created_at DESC`);
    const board = stages.rows.map((stage) => ({
      ...stage,
      deals: deals.rows.filter((d) => d.stage_id === stage.id),
    }));
    res.json(board);
  } catch (err) {
    console.error('pipeline view error:', err.message);
    res.status(500).json({ error: 'Failed to load pipeline', detail: err.message });
  }
});

module.exports = router;
