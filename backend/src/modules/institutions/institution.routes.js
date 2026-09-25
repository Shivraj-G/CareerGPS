import { Router } from 'express';
import { pool } from '../../config/database.js';

const router = Router();
router.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const result = await pool.query(`SELECT id, name, description, location, website_url, verification_status, source_url, source_document_url, source_last_checked_at, verified_at FROM institutions WHERE record_status = 'published' AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR location ILIKE '%' || $1 || '%') ORDER BY name LIMIT 100`, [search]);
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});
router.get('/:institutionId', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT id, name, description, location, website_url, verification_status, source_url, source_document_url, source_last_checked_at, verified_at FROM institutions WHERE id = $1 AND record_status = 'published'`, [req.params.institutionId]);
    if (!result.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Institution not found.' } });
    res.json({ data: result.rows[0] });
  } catch (e) { next(e); }
});
export default router;
