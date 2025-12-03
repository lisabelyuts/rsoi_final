export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Недостаточно прав' });
    next();
  };
}
