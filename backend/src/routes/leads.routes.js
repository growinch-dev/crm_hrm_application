const express = require('express');
const db = require('../db');
const { buildCrudRouter } = require('../utils/crudFactory');
const { requireEdit } = require('../middleware/auth');
const { createNotification } = require('../utils/notify');

const router = express.Router();

const selectSql = `
  SELECT leads.*, lead_sources.name as source_name, users.name as owner_name
  FROM leads
  LEFT JOIN lead_sources ON lead_sources.id = leads.source_id
  LEFT JOIN users ON users.id = leads.owner_id`;

router.use('/', buildCrudRouter({
  table: 'leads',
  columns: ['name', 'company_name', 'email', 'phone', 'source_id', 'status', 'score', 'estimated_value', 'owner_id', 'notes'],
  searchable: ['name', 'company_name', 'email', 'phone'],
  selectSql,
  defaultSort: 'leads.created_at DESC',
  onSave: (row) => {
    if (row.owner_id) {
      createNotification({
        userId: row.owner_id,
        type: 'lead_assigned',
        title: `New lead assigned: ${row.name}`,
        body: row.company_name ? `From ${row.company_name}` : undefined,
        link: '/crm/leads',
        sendEmail: true,
      });
    }
  },
}));

// Convert a lead into Company + Contact + Deal in one transaction (module 1 -> 2/3/4 flow)
router.post('/:id/convert', requireEdit, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const leadResult = await client.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    const lead = leadResult.rows[0];
    if (!lead) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Lead not found' });
    }

    const companyResult = await client.query(
      `INSERT INTO companies (name, owner_id) VALUES ($1, $2) RETURNING *`,
      [lead.company_name || lead.name, lead.owner_id]
    );
    const company = companyResult.rows[0];

    const contactResult = await client.query(
      `INSERT INTO contacts (company_id, first_name, email, phone, owner_id, is_primary) VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
      [company.id, lead.name, lead.email, lead.phone, lead.owner_id]
    );
    const contact = contactResult.rows[0];

    const stageResult = await client.query(`SELECT id FROM pipeline_stages ORDER BY sequence ASC LIMIT 1`);
    const firstStageId = stageResult.rows[0] ? stageResult.rows[0].id : null;

    const dealResult = await client.query(
      `INSERT INTO deals (name, company_id, contact_id, stage_id, amount, owner_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [`${lead.name} - Deal`, company.id, contact.id, firstStageId, lead.estimated_value || 0, lead.owner_id]
    );
    const deal = dealResult.rows[0];

    await client.query(
      `UPDATE leads SET status = 'converted', converted_company_id = $1, converted_contact_id = $2, converted_deal_id = $3, updated_at = now() WHERE id = $4`,
      [company.id, contact.id, deal.id, lead.id]
    );

    await client.query('COMMIT');
    res.json({ company, contact, deal });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('lead convert error:', err.message);
    res.status(500).json({ error: 'Failed to convert lead', detail: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
