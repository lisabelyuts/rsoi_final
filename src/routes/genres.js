import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT genre_id, genre_name FROM genres ORDER BY genre_name`);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Не удалось получить жанры' });
  }
});

export default router;
