const express = require('express');
const db = require('../db');
const { requireEdit } = require('../middleware/auth');

const router = express.Router();

const selectSql = `
  SELECT quotations.*, companies.name as company_name,
         contacts.first_name as contact_first_name, contacts.last_name as contact_last_name,
         users.name as owner_name
  FROM quotations
  LEFT JOIN companies ON companies.id = quotations.company_id
  LEFT JOIN contacts ON contacts.id = quotations.contact_id
  LEFT JOIN users ON users.id = quotations.owner_id`;

function computeTotals(items) {
  let subtotal = 0;
  let taxTotal = 0;
  const priced = items.map((it) => {
    const lineBase = Number(it.quantity) * Number(it.unit_price);
    const lineTax = lineBase * (Number(it.tax_percent || 0) / 100);
    subtotal += lineBase;
    taxTotal += lineTax;
    return { ...it, line_total: lineBase + lineTax };
  });
  return { priced, subtotal, taxTotal, total: subtotal + taxTotal };
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 200);
    const offset = (page - 1) * limit;
    const result = await db.query(`${selectSql} ORDER BY quotations.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    const count = await db.query(`SELECT COUNT(*) FROM quotations`);
    res.json({ data: result.rows, pagination: { page, limit, total: parseInt(count.rows[0].count, 10) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quotations', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const quote = await db.query(`${selectSql} WHERE quotations.id = $1`, [req.params.id]);
    if (quote.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });
    const items = await db.query(
      `SELECT quotation_items.*, products.name as product_name FROM quotation_items LEFT JOIN products ON products.id = quotation_items.product_id WHERE quotation_id = $1`,
      [req.params.id]
    );
    res.json({ ...quote.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quotation', detail: err.message });
  }
});

router.post('/', requireEdit, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { deal_id, company_id, contact_id, valid_until, notes, owner_id, items = [], status = 'draft' } = req.body;
    const { priced, subtotal, taxTotal, total } = computeTotals(items);
    const quoteNumber = `QT-${Date.now()}`;

    await client.query('BEGIN');
    const quoteResult = await client.query(
      `INSERT INTO quotations (quote_number, deal_id, company_id, contact_id, status, valid_until, subtotal, tax_total, total_amount, notes, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [quoteNumber, deal_id || null, company_id || null, contact_id || null, status, valid_until || null, subtotal, taxTotal, total, notes || null, owner_id || null]
    );
    const quote = quoteResult.rows[0];

    for (const item of priced) {
      await client.query(
        `INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, tax_percent, line_total) VALUES ($1,$2,$3,$4,$5,$6)`,
        [quote.id, item.product_id, item.quantity, item.unit_price, item.tax_percent || 0, item.line_total]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...quote, items: priced });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Failed to create quotation', detail: err.message });
  } finally {
    client.release();
  }
});

router.put('/:id', requireEdit, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { status, valid_until, notes, items } = req.body;
    await client.query('BEGIN');

    if (items) {
      const { priced, subtotal, taxTotal, total } = computeTotals(items);
      await client.query('DELETE FROM quotation_items WHERE quotation_id = $1', [req.params.id]);
      for (const item of priced) {
        await client.query(
          `INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, tax_percent, line_total) VALUES ($1,$2,$3,$4,$5,$6)`,
          [req.params.id, item.product_id, item.quantity, item.unit_price, item.tax_percent || 0, item.line_total]
        );
      }
      await client.query(
        `UPDATE quotations SET subtotal=$1, tax_total=$2, total_amount=$3, updated_at=now() WHERE id=$4`,
        [subtotal, taxTotal, total, req.params.id]
      );
    }

    const fields = [];
    const values = [];
    if (status !== undefined) { values.push(status); fields.push(`status = $${values.length}`); }
    if (valid_until !== undefined) { values.push(valid_until); fields.push(`valid_until = $${values.length}`); }
    if (notes !== undefined) { values.push(notes); fields.push(`notes = $${values.length}`); }
    if (fields.length) {
      values.push(req.params.id);
      await client.query(`UPDATE quotations SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
    }

    const result = await client.query(`${selectSql} WHERE quotations.id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Failed to update quotation', detail: err.message });
  } finally {
    client.release();
  }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM quotations WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete quotation', detail: err.message });
  }
});

// Convert an accepted quotation into a Sales Order (module 7 -> 8 flow)
router.post('/:id/convert-to-order', requireEdit, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const quoteResult = await client.query('SELECT * FROM quotations WHERE id = $1', [req.params.id]);
    const quote = quoteResult.rows[0];
    if (!quote) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Quotation not found' }); }

    const items = await client.query('SELECT * FROM quotation_items WHERE quotation_id = $1', [quote.id]);
    const orderNumber = `SO-${Date.now()}`;
    const orderResult = await client.query(
      `INSERT INTO sales_orders (order_number, quotation_id, company_id, contact_id, total_amount, owner_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orderNumber, quote.id, quote.company_id, quote.contact_id, quote.total_amount, quote.owner_id]
    );
    const order = orderResult.rows[0];

    for (const item of items.rows) {
      await client.query(
        `INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, line_total) VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.product_id, item.quantity, item.unit_price, item.line_total]
      );
    }

    await client.query(`UPDATE quotations SET status = 'accepted', updated_at = now() WHERE id = $1`, [quote.id]);
    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Failed to convert quotation to order', detail: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
