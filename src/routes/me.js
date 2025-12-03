import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';

const router = Router();

router.use(authRequired);

router.get('/summary', async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const [[user]] = await pool.query(
      `SELECT user_id, username, email, registration_date, role
       FROM users
       WHERE user_id = :user_id`,
      { user_id }
    );

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const [[reviewStats]] = await pool.query(
      `SELECT COUNT(*) AS reviews_count
       FROM reviews
       WHERE user_id = :user_id`,
      { user_id }
    );

    const [books] = await pool.query(
      `SELECT
         ub.book_id,
         ub.status,
         ub.created_at,
         b.title,
         b.cover_url,
         b.publication_year
       FROM user_books ub
       JOIN books b ON b.book_id = ub.book_id
       WHERE ub.user_id = :user_id
       ORDER BY ub.created_at DESC`,
      { user_id }
    );

    const lists = { want: [], reading: [], finished: [] };

    for (const row of books) {
      if (!lists[row.status]) {
        lists[row.status] = [];
      }
      lists[row.status].push(row);
    }

    const stats = {
      reviews_count: reviewStats?.reviews_count || 0,
      books_total: books.length,
      lists_counts: {
        want:    lists.want.length,
        reading: lists.reading.length,
        finished: lists.finished.length
      }
    };

    res.json({ user, stats, lists });
  } catch (e) {
    console.error('[GET /api/me/summary] error:', e);
    res.status(500).json({ error: 'Не удалось получить данные профиля' });
  }
});

export default router;
