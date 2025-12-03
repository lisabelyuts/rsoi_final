import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';

const router = Router();

router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const sql = `
      SELECT
        ub.book_id,
        ub.status,
        ub.created_at,
        b.title,
        b.publication_year,
        b.cover_url
      FROM user_books ub
      JOIN books b ON b.book_id = ub.book_id
      WHERE ub.user_id = :user_id
      ORDER BY ub.created_at DESC
    `;

    const [rows] = await pool.query(sql, { user_id });
    res.json(rows);
  } catch (e) {
    console.error('[GET /api/user/books] error:', e);
    res.status(500).json({ error: 'Не удалось получить список книг пользователя' });
  }
});

router.post('/', async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { book_id, status } = req.body || {};

    const bid = Number(book_id);
    if (!bid || Number.isNaN(bid)) {
      return res.status(400).json({ error: 'Некорректный book_id' });
    }

    const allowedStatus = ['want', 'reading', 'finished'];
    const st = allowedStatus.includes(status) ? status : 'want';

    const sql = `
      INSERT INTO user_books (user_id, book_id, status)
      VALUES (:user_id, :book_id, :status)
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    `;

    await pool.query(sql, { user_id, book_id: bid, status: st });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[POST /api/user/books] error:', e);
    res.status(500).json({ error: 'Не удалось сохранить книгу в списке' });
  }
});

router.delete('/:book_id', async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const book_id = Number(req.params.book_id);
    if (!book_id || Number.isNaN(book_id)) {
      return res.status(400).json({ error: 'Некорректный book_id' });
    }

    const [r] = await pool.query(
      `DELETE FROM user_books WHERE user_id = :user_id AND book_id = :book_id`,
      { user_id, book_id }
    );

    if (!r.affectedRows) {
      return res.status(404).json({ error: 'Книга не найдена в списке пользователя' });
    }

    res.status(204).send();
  } catch (e) {
    console.error('[DELETE /api/user/books/:book_id] error:', e);
    res.status(500).json({ error: 'Не удалось удалить книгу из списка' });
  }
});

export default router;
