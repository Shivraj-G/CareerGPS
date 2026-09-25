import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { pool } from '../../config/database.js';
import { getUserSkills, calculateSkillGap } from './skill-intelligence.service.js';

const router = Router();
const gapSchema = z.object({ target_career_id: z.string().uuid() });

router.get('/me', authenticate, async (req, res, next) => {
  try { res.json({ data: await getUserSkills(req.user.id) }); } catch (e) { next(e); }
});

router.put('/me', authenticate, async (req, res, next) => {
  try {
    const body = z.object({ skills: z.array(z.object({ skill_id: z.string().uuid(), level: z.enum(['beginner','intermediate','advanced','expert','unknown']).default('beginner'), years_experience: z.number().min(0).nullable().optional(), verified: z.boolean().optional() })) }).parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_skills WHERE user_id = $1', [req.user.id]);
      for (const skill of body.skills) await client.query(`INSERT INTO user_skills (user_id, skill_id, level, years_experience, verified) VALUES ($1,$2,$3,$4,$5)`, [req.user.id, skill.skill_id, skill.level, skill.years_experience ?? null, skill.verified ?? false]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    res.json({ data: await getUserSkills(req.user.id) });
  } catch (e) { next(e); }
});

router.post('/gap-analysis', authenticate, async (req, res, next) => {
  try {
    const { target_career_id } = gapSchema.parse(req.body);
    const career = await pool.query(`SELECT id, title FROM careers WHERE id = $1 AND record_status = 'published'`, [target_career_id]);
    if (!career.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Career not found.' } });
    const data = await calculateSkillGap(req.user.id, target_career_id);
    res.json({ data: { ...data, career_title: career.rows[0].title } });
  } catch (e) { next(e); }
});
export default router;
