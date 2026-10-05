import { Router } from 'express';
import { pool } from '../../config/database.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();
router.use(authenticate);

router.get('/me', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, role, account_status, created_at, updated_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    res.json({ data: result.rows[0] });
  } catch (error) { next(error); }
});

router.get('/me/ai-careers', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id as ai_career_id, c.title, c.description, c.responsibilities, c.qualifications,
              c.entry_routes, c.required_skills, c.related_careers, c.goa_relevance, c.status,
              s.pathway_progress, c.pathway_draft
       FROM user_ai_career_saves s
       JOIN ai_career_profiles c ON c.id = s.ai_career_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json({ data: result.rows.map(r => ({ ...r, origin: 'ai_generated', verified: false })) });
  } catch (error) { next(error); }
});

export default router;
