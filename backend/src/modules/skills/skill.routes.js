import { Router } from 'express';
import { pool } from '../../config/database.js';

const router = Router();
router.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const result = await pool.query(`SELECT id, name, description, category FROM skills WHERE record_status = 'published' AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%') ORDER BY name LIMIT 100`, [search]);
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});
export default router;
