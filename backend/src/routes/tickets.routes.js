const express = require('express');
const db = require('../db');
const { buildCrudRouter } = require('../utils/crudFactory');
const { requireEdit } = require('../middleware/auth');
const { createNotification } = require('../utils/notify');

const router = express.Router();

const selectSql = `
  SELECT tickets.*, companies.name as company_name,
         contacts.first_name as contact_first_name, contacts.last_name as contact_last_name,
         users.name as assigned_to_name
  FROM tickets
  LEFT JOIN companies ON companies.id = tickets.company_id
  LEFT JOIN contacts ON contacts.id = tickets.contact_id
  LEFT JOIN users ON users.id = tickets.assigned_to`;

function notifyAssignee(row) {
  if (row.assigned_to) {
    createNotification({
      userId: row.assigned_to,
      type: 'ticket_assigned',
      title: `Ticket assigned: ${row.subject}`,
      body: row.ticket_number,
      link: '/crm/tickets-page',
      sendEmail: true,
    });
  }
}

const crud = buildCrudRouter({
  table: 'tickets',
  columns: ['subject', 'description', 'company_id', 'contact_id', 'priority', 'status', 'category', 'assigned_to'],
  searchable: ['subject', 'description'],
  selectSql,
  defaultSort: 'tickets.created_at DESC',
  onSave: notifyAssignee,
});

// override create to auto-generate ticket_number
router.post('/', requireEdit, async (req, res) => {
  try {
    const { subject, description, company_id, contact_id, priority = 'medium', status = 'open', category, assigned_to } = req.body;
    if (!subject) return res.status(400).json({ error: 'subject is required' });
    const ticketNumber = `TCK-${Date.now()}`;
    const result = await db.query(
      `INSERT INTO tickets (ticket_number, subject, description, company_id, contact_id, priority, status, category, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [ticketNumber, subject, description || null, company_id || null, contact_id || null, priority, status, category || null, assigned_to || null]
    );
    res.status(201).json(result.rows[0]);
    notifyAssignee(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create ticket', detail: err.message });
  }
});

router.use('/', crud);

router.get('/:id/comments', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ticket_comments.*, users.name as user_name FROM ticket_comments LEFT JOIN users ON users.id = ticket_comments.user_id WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments', detail: err.message });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const { user_id, comment, is_internal = false } = req.body;
    if (!comment) return res.status(400).json({ error: 'comment is required' });
    const result = await db.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, user_id || null, comment, is_internal]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Failed to add comment', detail: err.message });
  }
});

module.exports = router;
