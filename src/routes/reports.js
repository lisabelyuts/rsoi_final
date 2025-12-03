import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.get('/top-books', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 100);

    const [rows] = await pool.query(
      `
      SELECT
        b.book_id,
        b.title,
        b.publication_year,
        ROUND(COALESCE(AVG(r.rating), 0), 2) AS avg_rating,
        COALESCE(COUNT(r.review_id), 0)      AS reviews_count
      FROM books b
      LEFT JOIN reviews r ON r.book_id = b.book_id
      GROUP BY b.book_id
      HAVING reviews_count > 0
      ORDER BY avg_rating DESC, reviews_count DESC, b.title ASC
      LIMIT ?
      `,
      [limit]
    );

    res.json(rows);
  } catch (e) {
    console.error('[GET /api/reports/top-books] error:', e);
    res.status(500).json({ error: 'Не удалось получить топ книг' });
  }
});

router.get('/top-authors', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 100);

    const [rows] = await pool.query(
      `
      SELECT
        a.author_id,
        a.full_name,
        COUNT(DISTINCT b.book_id)            AS books_count,
        COUNT(r.review_id)                   AS reviews_count,
        ROUND(COALESCE(AVG(r.rating), 0), 2) AS avg_rating
      FROM authors a
      JOIN book_authors ba ON ba.author_id = a.author_id
      JOIN books b        ON b.book_id = ba.book_id
      JOIN reviews r      ON r.book_id = b.book_id
      GROUP BY a.author_id
      HAVING reviews_count > 0
      ORDER BY avg_rating DESC, reviews_count DESC, a.full_name ASC
      LIMIT ?
      `,
      [limit]
    );

    res.json(rows);
  } catch (e) {
    console.error('[GET /api/reports/top-authors] error:', e);
    res.status(500).json({ error: 'Не удалось получить топ авторов' });
  }
});

router.get(
  '/summary',
  authRequired,
  requireRole('admin'),
  async (_req, res) => {
    try {
      const [[usersRow]] = await pool.query(
        'SELECT COUNT(*) AS users_count FROM users'
      );

      const [[booksRow]] = await pool.query(
        'SELECT COUNT(*) AS books_count FROM books'
      );

      const [[reviewsRow]] = await pool.query(
        `
        SELECT
          COUNT(*)              AS reviews_count,
          ROUND(AVG(rating), 2) AS avg_rating
        FROM reviews
        `
      );

      res.json({
        users_count:   usersRow?.users_count ?? 0,
        books_count:   booksRow?.books_count ?? 0,
        reviews_count: reviewsRow?.reviews_count ?? 0,
        avg_rating:    reviewsRow?.avg_rating ?? null
      });
    } catch (e) {
      console.error('[GET /api/reports/summary] error:', e);
      res.status(500).json({ error: 'Не удалось получить сводку' });
    }
  }
);

router.get(
  '/summary/csv',
  authRequired,
  requireRole('admin'),
  async (_req, res) => {
    try {
      const [[usersRow]] = await pool.query(
        'SELECT COUNT(*) AS users_count FROM users'
      );

      const [[booksRow]] = await pool.query(
        'SELECT COUNT(*) AS books_count FROM books'
      );

      const [[reviewsRow]] = await pool.query(
        `
        SELECT
          COUNT(*)              AS reviews_count,
          ROUND(AVG(rating), 2) AS avg_rating
        FROM reviews
        `
      );

      const csv =
        'users_count,books_count,reviews_count,avg_rating\n' +
        `${usersRow?.users_count ?? 0},` +
        `${booksRow?.books_count ?? 0},` +
        `${reviewsRow?.reviews_count ?? 0},` +
        `${reviewsRow?.avg_rating ?? ''}\n`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="summary.csv"'
      );
      res.send(csv);
    } catch (e) {
      console.error('[GET /api/reports/summary/csv] error:', e);
      res.status(500).json({ error: 'Не удалось сформировать CSV' });
    }
  }
);

router.get(
  '/genres-stats',
  authRequired,
  requireRole('admin'),
  async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT
          g.genre_id,
          g.genre_name,
          COUNT(DISTINCT bg.book_id) AS books_count
        FROM genres g
        LEFT JOIN book_genres bg ON bg.genre_id = g.genre_id
        GROUP BY g.genre_id, g.genre_name
        ORDER BY books_count DESC, g.genre_name ASC
        `
      );

      res.json(rows);
    } catch (e) {
      console.error('[GET /api/reports/genres-stats] error:', e);
      res.status(500).json({ error: 'Не удалось получить статистику по жанрам' });
    }
  }
);

router.get(
  '/reviews-by-day',
  authRequired,
  requireRole('admin'),
  async (req, res) => {
    try {
      const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 365);

      const [rows] = await pool.query(
        `
        SELECT
          DATE(review_date) AS date,
          COUNT(*)          AS reviews_count
        FROM reviews
        WHERE review_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(review_date)
        ORDER BY DATE(review_date)
        `,
        [days]
      );

      const data = rows.map((row) => ({
        label: row.date,
        reviews_count: row.reviews_count
      }));

      res.json(data);
    } catch (e) {
      console.error('[GET /api/reports/reviews-by-day] error:', e);
      res.status(500).json({ error: 'Не удалось получить статистику отзывов по дням' });
    }
  }
);

export default router;
