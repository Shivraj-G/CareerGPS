import { Router } from 'express';
import { pool } from '../../config/database.js';

const router = Router();
router.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let query = `
      SELECT DISTINCT i.id, i.name, i.description, i.location, i.website_url, i.verification_status, i.source_url
      FROM institutions i
      LEFT JOIN courses c ON c.institution_id = i.id
      WHERE i.record_status = 'published'
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (i.name ILIKE $1 OR i.location ILIKE $1 OR c.title ILIKE $1 OR c.course_type ILIKE $1)`;
    }

    // Count total rows for pagination
    const countResult = await pool.query(`SELECT COUNT(DISTINCT q.id) FROM (${query}) q`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY i.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    // For each institution, attach course names if needed by frontend
    const enrichedData = await Promise.all(result.rows.map(async (inst) => {
       const cResult = await pool.query(`SELECT title, course_type FROM courses WHERE institution_id = $1`, [inst.id]);
       return { ...inst, courses: cResult.rows };
    }));

    res.json({
      data: enrichedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (e) { next(e); }
});
router.get('/:institutionId', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT id, name, description, location, website_url, verification_status, source_url, source_document_url, source_last_checked_at, verified_at FROM institutions WHERE id = $1 AND record_status = 'published'`, [req.params.institutionId]);
    if (!result.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Institution not found.' } });
    
    const inst = result.rows[0];
    const cResult = await pool.query(`
      SELECT 
        c2.id, c2.title, c2.course_type, c2.qualification,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'careerId', cr.id,
              'careerName', cr.title,
              'description', substring(cr.description from 1 for 100),
              'relationshipReason', 'Requires ' || c1.title || ' or equivalent'
            )
          ) FILTER (WHERE cr.id IS NOT NULL), 
          '[]'
        ) AS career_directions
      FROM courses c2
      LEFT JOIN courses c1 ON (
        c1.title ILIKE c2.title OR 
        c1.subject ILIKE c2.title OR 
        c1.title ILIKE c2.subject OR 
        (c1.subject IS NOT NULL AND c2.subject IS NOT NULL AND c1.subject ILIKE c2.subject)
      )
      LEFT JOIN (
        SELECT id, title, description, qualifications FROM careers WHERE record_status = 'published'
        UNION ALL
        SELECT id, title, description, qualifications FROM ai_career_profiles WHERE status <> 'archived'
      ) cr ON (
        EXISTS (SELECT 1 FROM course_careers cc WHERE cc.course_id = c1.id AND cc.career_id = cr.id)
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(cr.qualifications) q
          WHERE c1.title ILIKE q OR q ILIKE c1.title OR c1.subject ILIKE q OR q ILIKE c1.subject
        )
      )
      WHERE c2.institution_id = $1
      GROUP BY c2.id
      ORDER BY c2.title
    `, [inst.id]);
    inst.courses = cResult.rows;

    res.json({ data: inst });
  } catch (e) { next(e); }
});
export default router;
