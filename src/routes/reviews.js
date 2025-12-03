import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';

const router = Router();

router.get('/books/:book_id', async (req, res) => {
  try {
    const book_id = Number(req.params.book_id);
    if (!book_id) {
      return res.status(400).json({ error: 'Некорректный book_id' });
    }

    const [rows] = await pool.query(
      `
      SELECT
        r.review_id,
        r.book_id,
        r.user_id,
        r.review_text,
        r.rating,
        r.review_date,
        u.username
      FROM reviews r
      JOIN users u ON u.user_id = r.user_id
      WHERE r.book_id = :book_id
      ORDER BY r.review_date DESC
      `,
      { book_id }
    );

    res.json(rows);
  } catch (e) {
    console.error('[reviews list] error:', e);
    res.status(500).json({ error: 'Не удалось получить отзывы' });
  }
});

router.post('/books/:book_id', authRequired, async (req, res) => {
  try {
    const book_id = Number(req.params.book_id);
    const user_id = req.user.user_id;
    const rating = Number(req.body?.rating);
    const review_text = req.body?.review_text ?? null;

    if (!book_id) {
      return res.status(400).json({ error: 'Некорректный book_id' });
    }
    if (!(rating >= 1 && rating <= 5)) {
      return res.status(400).json({ error: 'Оценка 1..5' });
    }

    const [bookCheck] = await pool.query(
      'SELECT book_id FROM books WHERE book_id = :book_id',
      { book_id }
    );
    if (!bookCheck.length) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }

    const [r] = await pool.query(
      `
      INSERT INTO reviews (book_id, user_id, review_text, rating)
      VALUES (:book_id, :user_id, :review_text, :rating)
      `,
      { book_id, user_id, review_text, rating }
    );

    const [[row]] = await pool.query(
      `
      SELECT
        r.review_id,
        r.book_id,
        r.user_id,
        r.review_text,
        r.rating,
        r.review_date,
        u.username
      FROM reviews r
      JOIN users u ON u.user_id = r.user_id
      WHERE r.review_id = :id
      `,
      { id: r.insertId }
    );

    res.status(201).json(row);
  } catch (e) {
    console.error('[reviews create] error:', e);
    res.status(500).json({ error: 'Не удалось создать рецензию' });
  }
});

router.put('/:review_id', authRequired, async (req, res) => {
  try {
    const review_id = Number(req.params.review_id);
    if (!review_id) {
      return res.status(400).json({ error: 'Некорректный id' });
    }

    const [[orig]] = await pool.query(
      'SELECT review_id, user_id FROM reviews WHERE review_id = :id',
      { id: review_id }
    );
    if (!orig) {
      return res.status(404).json({ error: 'Отзыв не найден' });
    }
    if (req.user.role !== 'admin' && req.user.user_id !== orig.user_id) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const rating =
      req.body?.rating == null ? null : Number(req.body.rating);
    const review_text = req.body?.review_text ?? null;

    if (rating != null && !(rating >= 1 && rating <= 5)) {
      return res.status(400).json({ error: 'Оценка 1..5' });
    }

    await pool.query(
      `
      UPDATE reviews
      SET rating = COALESCE(:rating, rating),
          review_text = :review_text
      WHERE review_id = :id
      `,
      { id: review_id, rating, review_text }
    );

    const [[row]] = await pool.query(
      `
      SELECT
        r.review_id,
        r.book_id,
        r.user_id,
        r.review_text,
        r.rating,
        r.review_date,
        u.username
      FROM reviews r
      JOIN users u ON u.user_id = r.user_id
      WHERE r.review_id = :id
      `,
      { id: review_id }
    );

    res.json(row);
  } catch (e) {
    console.error('[reviews update] error:', e);
    res.status(500).json({ error: 'Не удалось обновить рецензию' });
  }
});

router.delete('/:review_id', authRequired, async (req, res) => {
  try {
    const review_id = Number(req.params.review_id);
    if (!review_id) {
      return res.status(400).json({ error: 'Некорректный id' });
    }

    const [[orig]] = await pool.query(
      'SELECT review_id, user_id FROM reviews WHERE review_id = :id',
      { id: review_id }
    );
    if (!orig) {
      return res.status(404).json({ error: 'Отзыв не найден' });
    }
    if (req.user.role !== 'admin' && req.user.user_id !== orig.user_id) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    await pool.query(
      'DELETE FROM reviews WHERE review_id = :id',
      { id: review_id }
    );

    res.json({ ok: true });
  } catch (e) {
    console.error('[reviews delete] error:', e);
    res.status(500).json({ error: 'Не удалось удалить рецензию' });
  }
});

export default router;
