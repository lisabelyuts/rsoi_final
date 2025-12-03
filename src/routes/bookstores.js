import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT store_id, name, address, latitude, longitude, phone, website
       FROM bookstores`
    );
    res.json(rows);
  } catch (e) {
    console.error('[GET /api/bookstores] error:', e);
    res.status(500).json({ error: 'Не удалось получить список магазинов' });
  }
});

router.get('/near', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'Параметры lat и lng обязательны' });
    }

    const [rows] = await pool.query(
      `
      SELECT
        store_id,
        name,
        address,
        latitude,
        longitude,
        phone,
        website,
        (6371 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS(latitude - ?) / 2), 2) +
            COS(RADIANS(?)) * COS(RADIANS(latitude)) *
            POWER(SIN(RADIANS(longitude - ?) / 2), 2)
          )
        )) AS distance_km
      FROM bookstores
      ORDER BY distance_km ASC
      LIMIT ?
    `,
      [lat, lat, lng, limit]
    );

    res.json(rows);
  } catch (e) {
    console.error('[GET /api/bookstores/near] error:', e);
    res.status(500).json({ error: 'Не удалось найти ближайшие магазины' });
  }
});

export default router;
