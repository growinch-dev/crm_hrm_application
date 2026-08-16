const express = require('express');
const db = require('../db');
const { buildCrudRouter } = require('../utils/crudFactory');
const { requireEdit } = require('../middleware/auth');
const { createNotification } = require('../utils/notify');

const router = express.Router();

// ---- Chart of Accounts (simple lookup table) ----
router.use('/chart-of-accounts', buildCrudRouter({
  table: 'chart_of_accounts',
  columns: ['code', 'name', 'type', 'is_active'],
  searchable: ['code', 'name'],
  defaultSort: 'code ASC',
}));

// ---- Invoices (with line items, mirrors quotations.routes.js) ----
const invoiceSelectSql = `
  SELECT invoices.*, companies.name as company_name,
         contacts.first_name as contact_first_name, contacts.last_name as contact_last_name,
         users.name as owner_name
  FROM invoices
  LEFT JOIN companies ON companies.id = invoices.company_id
  LEFT JOIN contacts ON contacts.id = invoices.contact_id
  LEFT JOIN users ON users.id = invoices.owner_id`;

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

const invoicesRouter = express.Router();

invoicesRouter.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 200);
    const offset = (page - 1) * limit;
    const result = await db.query(`${invoiceSelectSql} ORDER BY invoices.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    const count = await db.query(`SELECT COUNT(*) FROM invoices`);
    res.json({ data: result.rows, pagination: { page, limit, total: parseInt(count.rows[0].count, 10) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices', detail: err.message });
  }
});

invoicesRouter.get('/:id', async (req, res) => {
  try {
    const invoice = await db.query(`${invoiceSelectSql} WHERE invoices.id = $1`, [req.params.id]);
    if (invoice.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const items = await db.query(
      `SELECT invoice_items.*, products.name as product_name FROM invoice_items LEFT JOIN products ON products.id = invoice_items.product_id WHERE invoice_id = $1`,
      [req.params.id]
    );
    res.json({ ...invoice.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice', detail: err.message });
  }
});

invoicesRouter.post('/', requireEdit, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { company_id, contact_id, sales_order_id, due_date, notes, owner_id, items = [], status = 'draft' } = req.body;
    const { priced, subtotal, taxTotal, total } = computeTotals(items);
    const invoiceNumber = `INV-${Date.now()}`;

    await client.query('BEGIN');
    const invoiceResult = await client.query(
      `INSERT INTO invoices (invoice_number, company_id, contact_id, sales_order_id, status, due_date, subtotal, tax_total, total_amount, notes, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [invoiceNumber, company_id || null, contact_id || null, sales_order_id || null, status, due_date || null, subtotal, taxTotal, total, notes || null, owner_id || null]
    );
    const invoice = invoiceResult.rows[0];

    for (const item of priced) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, tax_percent, line_total) VALUES ($1,$2,$3,$4,$5,$6)`,
        [invoice.id, item.product_id, item.quantity, item.unit_price, item.tax_percent || 0, item.line_total]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...invoice, items: priced });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Failed to create invoice', detail: err.message });
  } finally {
    client.release();
  }
});

invoicesRouter.put('/:id', requireEdit, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { status, due_date, notes, items } = req.body;
    await client.query('BEGIN');

    if (items) {
      const { priced, subtotal, taxTotal, total } = computeTotals(items);
      await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
      for (const item of priced) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, tax_percent, line_total) VALUES ($1,$2,$3,$4,$5,$6)`,
          [req.params.id, item.product_id, item.quantity, item.unit_price, item.tax_percent || 0, item.line_total]
        );
      }
      await client.query(
        `UPDATE invoices SET subtotal=$1, tax_total=$2, total_amount=$3, updated_at=now() WHERE id=$4`,
        [subtotal, taxTotal, total, req.params.id]
      );
    }

    const fields = [];
    const values = [];
    if (status !== undefined) { values.push(status); fields.push(`status = $${values.length}`); }
    if (due_date !== undefined) { values.push(due_date); fields.push(`due_date = $${values.length}`); }
    if (notes !== undefined) { values.push(notes); fields.push(`notes = $${values.length}`); }
    if (fields.length) {
      values.push(req.params.id);
      await client.query(`UPDATE invoices SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
    }

    const result = await client.query(`${invoiceSelectSql} WHERE invoices.id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Failed to update invoice', detail: err.message });
  } finally {
    client.release();
  }
});

invoicesRouter.delete('/:id', requireEdit, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM invoices WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete invoice', detail: err.message });
  }
});

router.use('/invoices', invoicesRouter);

// ---- Payments (receipts / payments, posting one may update the linked invoice) ----
const paymentsRouter = express.Router();

const paymentSelectSql = `
  SELECT payments.*, invoices.invoice_number, chart_of_accounts.name as account_name, users.name as recorded_by_name
  FROM payments
  LEFT JOIN invoices ON invoices.id = payments.invoice_id
  LEFT JOIN chart_of_accounts ON chart_of_accounts.id = payments.account_id
  LEFT JOIN users ON users.id = payments.recorded_by`;

paymentsRouter.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 200);
    const offset = (page - 1) * limit;
    const result = await db.query(`${paymentSelectSql} ORDER BY payments.payment_date DESC, payments.id DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    const count = await db.query(`SELECT COUNT(*) FROM payments`);
    res.json({ data: result.rows, pagination: { page, limit, total: parseInt(count.rows[0].count, 10) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments', detail: err.message });
  }
});

paymentsRouter.post('/', requireEdit, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { type, invoice_id, account_id, party_name, amount, payment_date, method, reference_no, notes, recorded_by } = req.body;
    if (!type || !amount) return res.status(400).json({ error: 'type and amount are required' });

    const paymentNumber = `${type === 'receipt' ? 'RCPT' : 'PAY'}-${Date.now()}`;

    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO payments (payment_number, type, invoice_id, account_id, party_name, amount, payment_date, method, reference_no, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [paymentNumber, type, invoice_id || null, account_id || null, party_name || null, amount, payment_date || new Date(), method || null, reference_no || null, notes || null, recorded_by || null]
    );
    const payment = result.rows[0];

    if (invoice_id) {
      const invoiceResult = await client.query('SELECT * FROM invoices WHERE id = $1', [invoice_id]);
      const invoice = invoiceResult.rows[0];
      if (invoice) {
        const newAmountPaid = Number(invoice.amount_paid) + Number(amount);
        const newStatus = newAmountPaid >= Number(invoice.total_amount) ? 'paid' : 'partially_paid';
        await client.query('UPDATE invoices SET amount_paid = $1, status = $2, updated_at = now() WHERE id = $3', [newAmountPaid, newStatus, invoice_id]);
        if (newStatus === 'paid' && invoice.owner_id) {
          createNotification({
            userId: invoice.owner_id,
            type: 'invoice_paid',
            title: `Invoice ${invoice.invoice_number} fully paid`,
            link: '/accounts/invoices-page',
            sendEmail: true,
          });
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json(payment);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Failed to record payment', detail: err.message });
  } finally {
    client.release();
  }
});

paymentsRouter.delete('/:id', requireEdit, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const paymentResult = await client.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    const payment = paymentResult.rows[0];
    if (!payment) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Payment not found' }); }

    if (payment.invoice_id) {
      const invoiceResult = await client.query('SELECT * FROM invoices WHERE id = $1', [payment.invoice_id]);
      const invoice = invoiceResult.rows[0];
      if (invoice) {
        const newAmountPaid = Math.max(0, Number(invoice.amount_paid) - Number(payment.amount));
        const newStatus = newAmountPaid <= 0 ? 'sent' : (newAmountPaid >= Number(invoice.total_amount) ? 'paid' : 'partially_paid');
        await client.query('UPDATE invoices SET amount_paid = $1, status = $2, updated_at = now() WHERE id = $3', [newAmountPaid, newStatus, payment.invoice_id]);
      }
    }

    await client.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true, id: payment.id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Failed to delete payment', detail: err.message });
  } finally {
    client.release();
  }
});

router.use('/payments', paymentsRouter);

// ---- Company Expenses (rent, utilities, software, etc. - distinct from HRM's per-employee expense_claims) ----
const expenseSelectSql = `
  SELECT company_expenses.*, chart_of_accounts.name as account_name, users.name as recorded_by_name
  FROM company_expenses
  LEFT JOIN chart_of_accounts ON chart_of_accounts.id = company_expenses.account_id
  LEFT JOIN users ON users.id = company_expenses.recorded_by`;

router.use('/expenses', buildCrudRouter({
  table: 'company_expenses',
  columns: ['expense_number', 'category', 'vendor_name', 'account_id', 'amount', 'expense_date', 'status', 'notes', 'recorded_by'],
  searchable: ['vendor_name', 'category'],
  selectSql: expenseSelectSql,
  defaultSort: 'company_expenses.expense_date DESC',
}));

router.post('/expenses/:id/mark-paid', requireEdit, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const expenseResult = await client.query('SELECT * FROM company_expenses WHERE id = $1', [req.params.id]);
    const expense = expenseResult.rows[0];
    if (!expense) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Expense not found' }); }

    const paymentNumber = `PAY-${Date.now()}`;
    await client.query(
      `INSERT INTO payments (payment_number, type, account_id, party_name, amount, method, recorded_by) VALUES ($1,'payment',$2,$3,$4,'bank_transfer',$5)`,
      [paymentNumber, expense.account_id, expense.vendor_name, expense.amount, req.body.recorded_by || expense.recorded_by || null]
    );
    const result = await client.query(`UPDATE company_expenses SET status = 'paid' WHERE id = $1 RETURNING *`, [req.params.id]);

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Failed to mark expense paid', detail: err.message });
  } finally {
    client.release();
  }
});

// ---- Ledger (simple per-account summary + overall invoicing summary) ----
router.get('/ledger', async (req, res) => {
  try {
    const accounts = await db.query(`
      SELECT coa.id, coa.code, coa.name, coa.type,
        COALESCE(SUM(CASE WHEN p.type = 'receipt' THEN p.amount ELSE 0 END), 0) AS total_in,
        COALESCE(SUM(CASE WHEN p.type = 'payment' THEN p.amount ELSE 0 END), 0) AS total_out
      FROM chart_of_accounts coa
      LEFT JOIN payments p ON p.account_id = coa.id
      GROUP BY coa.id
      ORDER BY coa.code ASC
    `);

    const summary = await db.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS total_invoiced,
        COALESCE(SUM(amount_paid), 0) AS total_collected,
        COALESCE(SUM(total_amount - amount_paid), 0) AS outstanding
      FROM invoices
    `);

    res.json({ accounts: accounts.rows, summary: summary.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build ledger', detail: err.message });
  }
});

module.exports = router;
