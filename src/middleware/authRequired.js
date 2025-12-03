import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; 
    next();
  } catch {
    res.status(401).json({ error: 'Невалидный или просроченный токен' });
  }
}
