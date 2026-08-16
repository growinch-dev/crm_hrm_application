const express = require('express');
const db = require('../db');
const { requireEdit } = require('../middleware/auth');

const router = express.Router();

const selectSql = `
  SELECT sales_orders.*, companies.name as company_name, users.name as owner_name
  FROM sales_orders
  LEFT JOIN companies ON companies.id = sales_orders.company_id
  LEFT JOIN users ON users.id = sales_orders.owner_id`;

router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 200);
    const offset = (page - 1) * limit;
    const result = await db.query(`${selectSql} ORDER BY sales_orders.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    const count = await db.query(`SELECT COUNT(*) FROM sales_orders`);
    res.json({ data: result.rows, pagination: { page, limit, total: parseInt(count.rows[0].count, 10) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales orders', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await db.query(`${selectSql} WHERE sales_orders.id = $1`, [req.params.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Sales order not found' });
    const items = await db.query(
      `SELECT sales_order_items.*, products.name as product_name FROM sales_order_items LEFT JOIN products ON products.id = sales_order_items.product_id WHERE sales_order_id = $1`,
      [req.params.id]
    );
    res.json({ ...order.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales order', detail: err.message });
  }
});

router.post('/', requireEdit, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { company_id, contact_id, owner_id, items = [] } = req.body;
    let total = 0;
    const priced = items.map((it) => {
      const lineTotal = Number(it.quantity) * Number(it.unit_price);
      total += lineTotal;
      return { ...it, line_total: lineTotal };
    });
    const orderNumber = `SO-${Date.now()}`;

    await client.query('BEGIN');
    const orderResult = await client.query(
      `INSERT INTO sales_orders (order_number, company_id, contact_id, total_amount, owner_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [orderNumber, company_id || null, contact_id || null, total, owner_id || null]
    );
    const order = orderResult.rows[0];
    for (const item of priced) {
      await client.query(
        `INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, line_total) VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.product_id, item.quantity, item.unit_price, item.line_total]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ ...order, items: priced });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Failed to create sales order', detail: err.message });
  } finally {
    client.release();
  }
});

router.put('/:id', requireEdit, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await db.query(
      `UPDATE sales_orders SET status = COALESCE($1, status), updated_at = now() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sales order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update sales order', detail: err.message });
  }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM sales_orders WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sales order not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete sales order', detail: err.message });
  }
});

module.exports = router;
