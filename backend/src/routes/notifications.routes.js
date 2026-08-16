const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const result = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications', detail: err.message });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const result = await db.query(`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`, [req.user.id]);
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count', detail: err.message });
  }
});

router.post('/:id/read', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Failed to mark notification read', detail: err.message });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    await db.query(`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to mark all notifications read', detail: err.message });
  }
});

router.delete('/clear-all', async (req, res) => {
  try {
    await db.query(`DELETE FROM notifications WHERE user_id = $1`, [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to clear notifications', detail: err.message });
  }
});

module.exports = router;
