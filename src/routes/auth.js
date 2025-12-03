import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { isEmail, isNonEmpty } from '../utils/validators.js';
import { authRequired } from '../middleware/authRequired.js';

const router = Router();
const normEmail = (v) => (v || '').trim().toLowerCase();

router.post('/register', async (req, res) => {
  try {
    let { username, email, password } = req.body || {};
    if (!isNonEmpty(username) || !isEmail(email) || !isNonEmpty(password)) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }

    email = normEmail(email);
    const [exists] = await pool.query(
      'SELECT user_id FROM users WHERE LOWER(email) = :email',
      { email }
    );
    if (exists.length) return res.status(409).json({ error: 'Пользователь уже существует' });

    const password_hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES (:username, :email, :password_hash, 'user')`,
      { username: username.trim(), email, password_hash }
    );

    const user = { user_id: r.insertId, username: username.trim(), email, role: 'user' };
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.status(201).json({ token, user });
  } catch {
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body || {};
    email = normEmail(email);
    password = String(password ?? '');

    if (!isEmail(email) || !isNonEmpty(password)) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }

    const [rows] = await pool.query(
      `SELECT user_id, username, email, password_hash, role
       FROM users
       WHERE LOWER(email) = :email`,
      { email }
    );
    if (!rows.length) return res.status(401).json({ error: 'Неверный email или пароль' });

    const u = rows[0];

    const ok = await bcrypt.compare(password, u.password_hash)
           || await bcrypt.compare(password.trim(), u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });

    const user = { user_id: u.user_id, username: u.username, email: normEmail(u.email), role: u.role };
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token, user });
  } catch {
    res.status(500).json({ error: 'Ошибка входа' });
  }
});


router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

export default router;
