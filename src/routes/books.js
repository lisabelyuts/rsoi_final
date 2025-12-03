import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/authRequired.js';
import { requireRole } from '../middleware/requireRole.js';
import { isNonEmpty } from '../utils/validators.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { sort, order, q, genre_id } = req.query;

    const sortMap = {
      title: 'b.title',
      year: 'b.publication_year',
      rating: 'avg_rating',
      reviews: 'reviews_count'
    };

    const sortKey = sortMap[sort] || 'b.title';

    let dir = String(order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    if (!order && (sort === 'rating' || sort === 'reviews')) {
      dir = 'DESC';
    }

    const conditions = [];
    const params = {};

    if (q && String(q).trim() !== '') {
      params.q = `%${String(q).toLowerCase()}%`;
      conditions.push(`(LOWER(b.title) LIKE :q OR LOWER(a.full_name) LIKE :q)`);
    }

    if (genre_id) {
      const gid = Number(genre_id);
      if (!Number.isNaN(gid)) {
        params.genre_id = gid;
        conditions.push('bg.genre_id = :genre_id');
      }
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        b.book_id,
        b.title,
        b.publication_year,
        b.description,
        b.cover_url,
        ROUND(COALESCE(AVG(r.rating), 0), 2)              AS avg_rating,
        COALESCE(COUNT(DISTINCT r.review_id), 0)          AS reviews_count
      FROM books b
      LEFT JOIN reviews      r  ON r.book_id  = b.book_id
      LEFT JOIN book_authors ba ON ba.book_id = b.book_id
      LEFT JOIN authors      a  ON a.author_id = ba.author_id
      LEFT JOIN book_genres  bg ON bg.book_id = b.book_id
      ${whereSql}
      GROUP BY b.book_id
      ORDER BY ${sortKey} ${dir}
    `;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[GET /api/books] error:', e);
    res.status(500).json({ error: 'Не удалось получить список книг' });
  }
});

router.get('/compare', async (req, res) => {
  try {
    const idsParam = String(req.query.ids || '')
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isInteger(n) && n > 0);

    if (idsParam.length < 2) {
      return res.status(400).json({ error: 'Нужно выбрать минимум две книги для сравнения' });
    }

    const placeholders = idsParam.map(() => '?').join(',');

    const sql = `
      SELECT
        b.book_id,
        b.title,
        b.publication_year,
        b.description,
        b.cover_url,
        ROUND(COALESCE(AVG(r.rating), 0), 2)              AS avg_rating,
        COALESCE(COUNT(DISTINCT r.review_id), 0)          AS reviews_count,
        GROUP_CONCAT(DISTINCT a.full_name ORDER BY a.full_name SEPARATOR ', ') AS authors,
        GROUP_CONCAT(DISTINCT g.genre_name ORDER BY g.genre_name SEPARATOR ', ') AS genres
      FROM books b
      LEFT JOIN reviews      r  ON r.book_id  = b.book_id
      LEFT JOIN book_authors ba ON ba.book_id = b.book_id
      LEFT JOIN authors      a  ON a.author_id = ba.author_id
      LEFT JOIN book_genres  bg ON bg.book_id = b.book_id
      LEFT JOIN genres       g  ON g.genre_id = bg.genre_id
      WHERE b.book_id IN (${placeholders})
      GROUP BY b.book_id
    `;

    const [rows] = await pool.query(sql, idsParam);
    res.json(rows);
  } catch (e) {
    console.error('[GET /api/books/compare] error:', e);
    res.status(500).json({ error: 'Не удалось сравнить книги' });
  }
});

router.get('/:book_id', async (req, res) => {
  try {
    const book_id = Number(req.params.book_id);

    const [[book]] = await pool.query(
      `SELECT * FROM books WHERE book_id = :book_id`,
      { book_id }
    );
    if (!book) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }

    const [authors] = await pool.query(
      `
      SELECT a.author_id, a.full_name, a.country
      FROM authors a
      JOIN book_authors ba ON ba.author_id = a.author_id
      WHERE ba.book_id = :book_id
      `,
      { book_id }
    );

    const [genres] = await pool.query(
      `
      SELECT g.genre_id, g.genre_name
      FROM genres g
      JOIN book_genres bg ON bg.genre_id = g.genre_id
      WHERE bg.book_id = :book_id
      `,
      { book_id }
    );

    const [[stats]] = await pool.query(
      `
      SELECT
        ROUND(COALESCE(AVG(rating), 0), 2) AS avg_rating,
        COALESCE(COUNT(*), 0)              AS reviews_count
      FROM reviews
      WHERE book_id = :book_id
      `,
      { book_id }
    );

    res.json({ ...book, authors, genres, ...stats });
  } catch (e) {
    console.error('[GET /api/books/:book_id] error:', e);
    res.status(500).json({ error: 'Не удалось получить книгу' });
  }
});

router.post('/', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const {
      title,
      publication_year,
      description,
      cover_url,
      author_ids = [],
      genre_ids = []
    } = req.body || {};

    if (!isNonEmpty(title)) {
      return res.status(400).json({ error: 'title обязателен' });
    }

    const [r] = await pool.query(
      `
      INSERT INTO books (title, publication_year, description, cover_url)
      VALUES (:title, :publication_year, :description, :cover_url)
      `,
      {
        title,
        publication_year: publication_year ?? null,
        description: description ?? null,
        cover_url: cover_url ?? null
      }
    );

    const book_id = r.insertId;

    if (Array.isArray(author_ids) && author_ids.length) {
      const values = author_ids
        .map(aid => `(${book_id}, ${Number(aid)})`)
        .join(',');
      await pool.query(
        `INSERT IGNORE INTO book_authors (book_id, author_id) VALUES ${values}`
      );
    }

    if (Array.isArray(genre_ids) && genre_ids.length) {
      const values = genre_ids
        .map(gid => `(${book_id}, ${Number(gid)})`)
        .join(',');
      await pool.query(
        `INSERT IGNORE INTO book_genres (book_id, genre_id) VALUES ${values}`
      );
    }

    const [[created]] = await pool.query(
      `SELECT * FROM books WHERE book_id = :book_id`,
      { book_id }
    );

    res.status(201).json(created);
  } catch (e) {
    console.error('[POST /api/books] error:', e);
    res.status(500).json({ error: 'Не удалось создать книгу' });
  }
});

router.put('/:book_id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const book_id = Number(req.params.book_id);
    const {
      title,
      publication_year,
      description,
      cover_url,
      author_ids,
      genre_ids
    } = req.body || {};

    const [[exists]] = await pool.query(
      `SELECT book_id FROM books WHERE book_id = :book_id`,
      { book_id }
    );
    if (!exists) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }

    await pool.query(
      `
      UPDATE books
      SET title = COALESCE(:title, title),
          publication_year = :publication_year,
          description = :description,
          cover_url = :cover_url
      WHERE book_id = :book_id
      `,
      {
        book_id,
        title: title ?? null,
        publication_year: typeof publication_year === 'number' ? publication_year : null,
        description: description ?? null,
        cover_url: cover_url ?? null
      }
    );

    if (Array.isArray(author_ids)) {
      await pool.query(
        `DELETE FROM book_authors WHERE book_id = :book_id`,
        { book_id }
      );
      if (author_ids.length) {
        const values = author_ids
          .map(aid => `(${book_id}, ${Number(aid)})`)
          .join(',');
        await pool.query(
          `INSERT IGNORE INTO book_authors (book_id, author_id) VALUES ${values}`
        );
      }
    }

    if (Array.isArray(genre_ids)) {
      await pool.query(
        `DELETE FROM book_genres WHERE book_id = :book_id`,
        { book_id }
      );
      if (genre_ids.length) {
        const values = genre_ids
          .map(gid => `(${book_id}, ${Number(gid)})`)
          .join(',');
        await pool.query(
          `INSERT IGNORE INTO book_genres (book_id, genre_id) VALUES ${values}`
        );
      }
    }

    const [[updated]] = await pool.query(
      `SELECT * FROM books WHERE book_id = :book_id`,
      { book_id }
    );

    res.json(updated);
  } catch (e) {
    console.error('[PUT /api/books/:book_id] error:', e);
    res.status(500).json({ error: 'Не удалось обновить книгу' });
  }
});

router.delete('/:book_id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const book_id = Number(req.params.book_id);

    const [r] = await pool.query(
      `DELETE FROM books WHERE book_id = :book_id`,
      { book_id }
    );

    if (!r.affectedRows) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }

    res.status(204).send();
  } catch (e) {
    console.error('[DELETE /api/books/:book_id] error:', e);
    res.status(500).json({ error: 'Не удалось удалить книгу' });
  }
});

export default router;
