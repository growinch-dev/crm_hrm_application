const express = require('express');
const db = require('../db');
const { requireEdit } = require('../middleware/auth');

/**
 * Builds a fully working REST router (list/get/create/update/delete) for a table.
 *
 * options:
 *  table        - db table name (required)
 *  columns      - whitelist of insertable/updatable columns (required)
 *  searchable   - columns included in the `?q=` free-text search (optional)
 *  selectSql    - custom "SELECT ... FROM table LEFT JOIN ..." for list/get, enriches
 *                 the row with joined labels (e.g. owner name). Falls back to `SELECT * FROM table`.
 *  defaultSort  - ORDER BY clause, e.g. 'created_at DESC' (default: 'id DESC')
 *  idColumn     - primary key column name (default: 'id')
 *  onSave(row, req) - optional, fired-and-forgotten after a successful create/update
 *                 (e.g. to send a notification). Never blocks or fails the request.
 */
function buildCrudRouter(options) {
  const {
    table,
    columns,
    searchable = [],
    selectSql = `SELECT * FROM ${options.table}`,
    defaultSort = 'id DESC',
    idColumn = 'id',
    onSave,
  } = options;

  const fireOnSave = (row, req) => {
    if (!onSave) return;
    Promise.resolve(onSave(row, req)).catch((err) => console.error(`[${table}] onSave hook failed:`, err.message));
  };

  const router = express.Router();

  // ---- LIST (with pagination + optional search + simple equality filters) ----
  router.get('/', async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(parseInt(req.query.limit) || 25, 200);
      const offset = (page - 1) * limit;

      const whereClauses = [];
      const params = [];

      if (req.query.q && searchable.length > 0) {
        params.push(`%${req.query.q}%`);
        const ors = searchable.map((c) => `${c}::text ILIKE $${params.length}`).join(' OR ');
        whereClauses.push(`(${ors})`);
      }

      // Simple equality filters: any query param matching a whitelisted column
      for (const col of columns) {
        if (req.query[col] !== undefined) {
          params.push(req.query[col]);
          whereClauses.push(`${table}.${col} = $${params.length}`);
        }
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const baseSelect = selectSql; // may already contain JOINs
      const dataSql = `${baseSelect} ${whereSql} ORDER BY ${defaultSort} LIMIT ${limit} OFFSET ${offset}`;
      const countSql = `SELECT COUNT(*) FROM ${table} ${whereSql.replace(new RegExp(`${table}\\.`, 'g'), '')}`;

      const [dataResult, countResult] = await Promise.all([
        db.query(dataSql, params),
        db.query(countSql, params),
      ]);

      res.json({
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].count, 10),
          totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
        },
      });
    } catch (err) {
      console.error(`[${table}] list error:`, err.message);
      res.status(500).json({ error: 'Failed to fetch records', detail: err.message });
    }
  });

  // ---- GET ONE ----
  router.get('/:id', async (req, res) => {
    try {
      const sql = `${selectSql} WHERE ${table}.${idColumn} = $1`;
      const result = await db.query(sql, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(`[${table}] get error:`, err.message);
      res.status(500).json({ error: 'Failed to fetch record', detail: err.message });
    }
  });

  // ---- CREATE ----
  router.post('/', requireEdit, async (req, res) => {
    try {
      const keys = columns.filter((c) => req.body[c] !== undefined);
      if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

      const values = keys.map((k) => req.body[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const result = await db.query(sql, values);
      res.status(201).json(result.rows[0]);
      fireOnSave(result.rows[0], req);
    } catch (err) {
      console.error(`[${table}] create error:`, err.message);
      res.status(400).json({ error: 'Failed to create record', detail: err.message });
    }
  });

  // ---- UPDATE ----
  router.put('/:id', requireEdit, async (req, res) => {
    try {
      const keys = columns.filter((c) => req.body[c] !== undefined);
      if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

      const values = keys.map((k) => req.body[k]);
      const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const hasUpdatedAt = await columnExists(table, 'updated_at');
      const touchUpdatedAt = hasUpdatedAt ? ', updated_at = now()' : '';

      const sql = `UPDATE ${table} SET ${setClause}${touchUpdatedAt} WHERE ${idColumn} = $${keys.length + 1} RETURNING *`;
      const result = await db.query(sql, [...values, req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
      res.json(result.rows[0]);
      fireOnSave(result.rows[0], req);
    } catch (err) {
      console.error(`[${table}] update error:`, err.message);
      res.status(400).json({ error: 'Failed to update record', detail: err.message });
    }
  });

  // ---- DELETE ----
  router.delete('/:id', requireEdit, async (req, res) => {
    try {
      const sql = `DELETE FROM ${table} WHERE ${idColumn} = $1 RETURNING ${idColumn}`;
      const result = await db.query(sql, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
      res.json({ success: true, id: result.rows[0][idColumn] });
    } catch (err) {
      console.error(`[${table}] delete error:`, err.message);
      res.status(400).json({ error: 'Failed to delete record (it may be referenced elsewhere)', detail: err.message });
    }
  });

  return router;
}

// small cache so we don't re-check information_schema on every single update call
const _updatedAtCache = {};
async function columnExists(table, column) {
  const key = `${table}.${column}`;
  if (_updatedAtCache[key] !== undefined) return _updatedAtCache[key];
  const result = await db.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  _updatedAtCache[key] = result.rows.length > 0;
  return _updatedAtCache[key];
}

module.exports = { buildCrudRouter };
