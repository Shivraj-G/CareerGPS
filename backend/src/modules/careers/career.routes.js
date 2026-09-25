import { Router } from 'express';
import { pool } from '../../config/database.js';

const router = Router();
function pagination(req) {
  const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit ?? '20', 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

router.get('/', async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const values = [search];
    const where = `WHERE c.record_status = 'published' AND ($1 = '' OR c.title ILIKE '%' || $1 || '%' OR c.description ILIKE '%' || $1 || '%')`;
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM careers c ${where}`, values);
    values.push(limit, offset);
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
              c.verification_status, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
       FROM careers c ${where} ORDER BY c.title ASC LIMIT $2 OFFSET $3`, values
    );
    const total = count.rows[0].total;
    res.json({ data: result.rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
});

router.get('/:careerId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
              c.verification_status, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
       FROM careers c WHERE c.id = $1 AND c.record_status = 'published'`, [req.params.careerId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Career not found.' } });
    res.json({ data: result.rows[0] });
  } catch (e) { next(e); }
});

router.get('/:careerId/skills', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT s.id, s.name, s.description, cs.importance FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1 AND s.record_status = 'published' ORDER BY CASE cs.importance WHEN 'required' THEN 1 WHEN 'important' THEN 2 ELSE 3 END, s.name`, [req.params.careerId]);
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});

router.get('/:careerId/courses', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT c.id, c.title, c.course_type, c.qualification, c.duration_text, c.mode, c.location, c.subject, c.fees_text, i.id AS institution_id, i.name AS institution_name FROM course_careers cc JOIN courses c ON c.id = cc.course_id LEFT JOIN institutions i ON i.id = c.institution_id WHERE cc.career_id = $1 AND c.record_status = 'published' ORDER BY c.title`, [req.params.careerId]);
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});

export default router;
