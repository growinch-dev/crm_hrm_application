const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/summary', async (req, res) => {
  try {
    const [leads, deals, wonDeals, pipelineValue, tickets, revenue, leadsByStatus, dealsByStage, ticketsByStatus] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM leads`),
      db.query(`SELECT COUNT(*) FROM deals WHERE status = 'open'`),
      db.query(`SELECT COUNT(*) FROM deals WHERE status = 'won'`),
      db.query(`SELECT COALESCE(SUM(amount),0) as total FROM deals WHERE status = 'open'`),
      db.query(`SELECT COUNT(*) FROM tickets WHERE status NOT IN ('resolved','closed')`),
      db.query(`SELECT COALESCE(SUM(amount),0) as total FROM deals WHERE status = 'won'`),
      db.query(`SELECT status, COUNT(*) as count FROM leads GROUP BY status`),
      db.query(`SELECT pipeline_stages.name as stage, COUNT(deals.id) as count, COALESCE(SUM(deals.amount),0) as value
                 FROM pipeline_stages LEFT JOIN deals ON deals.stage_id = pipeline_stages.id AND deals.status='open'
                 GROUP BY pipeline_stages.name, pipeline_stages.sequence ORDER BY pipeline_stages.sequence`),
      db.query(`SELECT status, COUNT(*) as count FROM tickets GROUP BY status`),
    ]);

    res.json({
      totalLeads: parseInt(leads.rows[0].count, 10),
      openDeals: parseInt(deals.rows[0].count, 10),
      wonDeals: parseInt(wonDeals.rows[0].count, 10),
      openPipelineValue: parseFloat(pipelineValue.rows[0].total),
      openTickets: parseInt(tickets.rows[0].count, 10),
      totalRevenue: parseFloat(revenue.rows[0].total),
      leadsByStatus: leadsByStatus.rows,
      dealsByStage: dealsByStage.rows,
      ticketsByStatus: ticketsByStatus.rows,
    });
  } catch (err) {
    console.error('crm dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to load CRM dashboard', detail: err.message });
  }
});

module.exports = router;
