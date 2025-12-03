import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

import authRoute from './routes/auth.js';
import booksRoute from './routes/books.js';
import reviewsRoute from './routes/reviews.js';
import authorsRoute from './routes/authors.js';
import genresRoute from './routes/genres.js';
import reportsRoute from './routes/reports.js';
import userBooksRoute from './routes/userBooks.js';
import meRoute from './routes/me.js';
import bookstoresRoutes from './routes/bookstores.js';

dotenv.config();
const app = express();

// статика клиента
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/', express.static(path.join(__dirname, '../../client')));

app.use(cors());
app.use(express.json());

// API
app.use('/api/auth', authRoute);
app.use('/api/books', booksRoute);
app.use('/api/reviews', reviewsRoute);
app.use('/api/authors', authorsRoute);
app.use('/api/genres', genresRoute);
app.use('/api/reports', reportsRoute);
app.use('/api/user/books', userBooksRoute);
app.use('/api/me', meRoute);
app.use('/api/bookstores', bookstoresRoutes);

// ping DB и запуск
const port = process.env.PORT || 3000;
(async () => {
  try {
    await pool.query('SELECT 1');
    app.listen(port, () => console.log(`[server] http://localhost:${port}`));
  } catch (e) {
    console.error('DB init error', e);
    process.exit(1);
  }
})();
