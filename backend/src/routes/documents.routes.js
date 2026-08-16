const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireEdit } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

const selectSql = `SELECT documents.*, users.name as uploaded_by_name FROM documents LEFT JOIN users ON users.id = documents.uploaded_by`;

router.get('/', async (req, res) => {
  try {
    const { related_to_type, related_to_id } = req.query;
    const clauses = [];
    const params = [];
    if (related_to_type) { params.push(related_to_type); clauses.push(`related_to_type = $${params.length}`); }
    if (related_to_id) { params.push(related_to_id); clauses.push(`related_to_id = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await db.query(`${selectSql} ${where} ORDER BY uploaded_at DESC`, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents', detail: err.message });
  }
});

router.post('/', requireEdit, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { related_to_type, related_to_id, doc_category, uploaded_by } = req.body;
    const result = await db.query(
      `INSERT INTO documents (related_to_type, related_to_id, file_name, file_path, file_type, file_size, doc_category, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [related_to_type || null, related_to_id || null, req.file.originalname, `/uploads/${req.file.filename}`, req.file.mimetype, req.file.size, doc_category || null, uploaded_by || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Failed to upload document', detail: err.message });
  }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const doc = result.rows[0];
    const filePath = path.join(uploadDir, path.basename(doc.file_path));
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
    await db.query('DELETE FROM documents WHERE id = $1', [req.params.id]);
    res.json({ success: true, id: doc.id });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete document', detail: err.message });
  }
});

module.exports = router;
