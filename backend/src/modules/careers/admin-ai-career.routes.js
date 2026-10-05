import { Router } from 'express';
import { pool } from '../../config/database.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate, authorize('ADMIN', 'REVIEWER'));

const uuidSchema = z.object({ id: z.string().uuid() });

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status || 'unverified';
    const result = await pool.query(
      `SELECT id as ai_career_id, title, description, responsibilities, qualifications, entry_routes,
              required_skills, related_careers, goa_relevance, status
       FROM ai_career_profiles WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    );
    res.json({ data: result.rows });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/archive', async (req, res, next) => {
  try {
    const { id } = uuidSchema.parse(req.params);
    await pool.query(
      `UPDATE ai_career_profiles SET status = 'archived', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    res.json({ success: true });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID' } });
    next(e);
  }
});

router.post('/:id/promote', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = uuidSchema.parse(req.params);
    const aiCareerResult = await client.query(`SELECT * FROM ai_career_profiles WHERE id = $1 AND status = 'unverified'`, [id]);
    const aiCareer = aiCareerResult.rows[0];
    if (!aiCareer) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unverified AI career not found' } });

    await client.query('BEGIN');

    // Insert into careers
    const curCareerRes = await client.query(
      `INSERT INTO careers (title, description, responsibilities, qualifications, entry_routes, origin, record_status, verification_status)
       VALUES ($1, $2, $3, $4, $5, 'ai_generated', 'published', 'verified')
       ON CONFLICT (title) DO UPDATE SET description = EXCLUDED.description
       RETURNING id`,
      [
        aiCareer.title, aiCareer.description, JSON.stringify(aiCareer.responsibilities),
        JSON.stringify(aiCareer.qualifications), JSON.stringify(aiCareer.entry_routes)
      ]
    );
    const curatedCareerId = curCareerRes.rows[0].id;

    if (aiCareer.required_skills) {
      for (const sk of aiCareer.required_skills) {
        const rawSkillName = sk.matches_catalogue_skill || sk.name;
        if (!rawSkillName || typeof rawSkillName !== 'string') continue;
        const skillName = rawSkillName.trim().replace(/\s+/g, ' ');
        if (!skillName) continue;

        let skillId;
        const exist = await client.query('SELECT id FROM skills WHERE lower(name) = lower($1) LIMIT 1', [skillName]);
        if (exist.rows.length > 0) {
          skillId = exist.rows[0].id;
          await client.query('UPDATE skills SET updated_at = NOW() WHERE id = $1', [skillId]);
        } else {
          try {
            const skillRow = await client.query(
              `INSERT INTO skills (name, origin, verification_status, record_status)
               VALUES ($1, 'ai_generated', 'verified', 'published') RETURNING id`, [skillName]
            );
            skillId = skillRow.rows[0].id;
          } catch (err) {
            if (err.code === '23505') {
              const reExist = await client.query('SELECT id FROM skills WHERE lower(name) = lower($1) LIMIT 1', [skillName]);
              skillId = reExist.rows[0].id;
              await client.query('UPDATE skills SET updated_at = NOW() WHERE id = $1', [skillId]);
            } else throw err;
          }
        }
        
        await client.query(
          `INSERT INTO career_skills (career_id, skill_id, importance, origin, verification_status)
           VALUES ($1, $2, $3, 'ai_generated', 'verified')
           ON CONFLICT (career_id, skill_id) DO NOTHING`,
          [curatedCareerId, skillId, sk.importance || 'useful']
        );
      }
    }

    // Update AI profile
    await client.query(
      `UPDATE ai_career_profiles SET status = 'promoted', promoted_career_id = $1, updated_at = NOW() WHERE id = $2`,
      [curatedCareerId, id]
    );
    
    // Audit logs
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'promote_ai_career', 'ai_career_profiles', $2, $3)`,
      [req.user.id, id, JSON.stringify({ curated_career_id: curatedCareerId })]
    );

    await client.query('COMMIT');
    res.json({ success: true, curated_career_id: curatedCareerId });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID' } });
    next(e);
  } finally {
    client.release();
  }
});

export default router;
