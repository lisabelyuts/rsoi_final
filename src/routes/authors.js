import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT author_id, full_name, country
       FROM authors
       ORDER BY full_name`
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Не удалось получить авторов' });
  }
});

router.post('/', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const full_name = String(req.body?.full_name || '').trim();
    const country   = (req.body?.country == null ? null : String(req.body.country).trim()) || null;

    if (!full_name) return res.status(400).json({ error: 'Укажите имя автора' });

    const [exists] = await pool.query(
      `SELECT author_id FROM authors WHERE LOWER(full_name) = :name LIMIT 1`,
      { name: full_name.toLowerCase() }
    );
    if (exists.length) {
      const a = exists[0];
      return res.status(200).json({ author_id: a.author_id, full_name, country: exists[0].country ?? null, existed: true });
    }

    const [r] = await pool.query(
      `INSERT INTO authors (full_name, country) VALUES (:full_name, :country)`,
      { full_name, country }
    );

    res.status(201).json({ author_id: r.insertId, full_name, country });
  } catch (e) {
    console.error('[authors POST] error:', e);
    res.status(500).json({ error: 'Не удалось создать автора' });
  }
});

export default router;
