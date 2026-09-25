import { Router } from 'express';
import { pool } from '../../config/database.js';

const router = Router();
router.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const mode = typeof req.query.mode === 'string' ? req.query.mode.trim() : '';
    const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
    const result = await pool.query(
      `SELECT c.id, c.title, c.course_type, c.qualification, c.duration_text, c.mode, c.location, c.subject, c.fees_text,
              i.id AS institution_id, i.name AS institution_name, c.verification_status, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
       FROM courses c LEFT JOIN institutions i ON i.id = c.institution_id
       WHERE c.record_status = 'published'
         AND ($1 = '' OR c.title ILIKE '%' || $1 || '%' OR c.subject ILIKE '%' || $1 || '%')
         AND ($2 = '' OR c.mode = $2)
         AND ($3 = '' OR c.location ILIKE '%' || $3 || '%')
       ORDER BY c.title LIMIT 100`, [search, mode, location]
    );
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});
router.get('/:courseId', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT c.id, c.title, c.course_type, c.qualification, c.duration_text, c.mode, c.location, c.subject, c.fees_text, c.description, i.id AS institution_id, i.name AS institution_name, c.verification_status, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at FROM courses c LEFT JOIN institutions i ON i.id = c.institution_id WHERE c.id = $1 AND c.record_status = 'published'`, [req.params.courseId]);
    if (!result.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Course not found.' } });
    res.json({ data: result.rows[0] });
  } catch (e) { next(e); }
});
router.get('/:courseId/eligibility', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT id, rule_type, rule_data, verification_status, source_url FROM course_eligibility_rules WHERE course_id = $1 ORDER BY id`, [req.params.courseId]);
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});
export default router;
