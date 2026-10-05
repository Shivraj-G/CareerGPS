import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { getUserSkills, calculateSkillGap, calculateAiSkillGap } from './skill-intelligence.service.js';

const router = Router();
const gapSchema = z.object({ 
  target_career_id: z.string().uuid().optional(),
  target_ai_career_id: z.string().uuid().optional() 
}).refine(data => data.target_career_id || data.target_ai_career_id, {
  message: "Either target_career_id or target_ai_career_id must be provided"
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const data = await getUserSkills(req.user.id);
    const customRes = await pool.query(`SELECT id, name, level FROM user_custom_skills WHERE user_id = $1 ORDER BY name`, [req.user.id]);
    const custom_skills = customRes.rows.map(r => ({...r, origin: 'ai_generated', verified: false, is_custom: true}));
    res.json({ data, custom_skills });
  } catch (e) { next(e); }
});

const customSkillSchema = z.object({
  name: z.string().min(1).max(60).transform(v => v.replace(/<[^>]*>?/gm, '').replace(/[\x00-\x1F\x7F]/g, '').trim()),
  level: z.enum(['beginner','intermediate','advanced','expert','unknown']).default('beginner')
});

function normalizeString(str) {
  return str.toLowerCase().replace(/[^a-z0-9+#]/g, '');
}

router.post('/me/custom', authenticate, async (req, res, next) => {
  try {
    const { name, level } = customSkillSchema.parse(req.body);
    const normalized_name = normalizeString(name);
    if (!normalized_name) return res.status(400).json({ error: { code: 'INVALID_NAME', message: 'Name invalid' } });

    const checkRes = await pool.query('SELECT id FROM user_custom_skills WHERE user_id = $1 AND normalized_name = $2', [req.user.id, normalized_name]);
    if (checkRes.rows.length === 0) {
      const countRes = await pool.query('SELECT count(*) FROM user_custom_skills WHERE user_id = $1', [req.user.id]);
      if (parseInt(countRes.rows[0].count) >= 50) {
        return res.status(400).json({ error: { code: 'LIMIT_EXCEEDED', message: 'Maximum 50 custom skills allowed' } });
      }
    }

    const upsertRes = await pool.query(
      `INSERT INTO user_custom_skills (user_id, name, normalized_name, level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, normalized_name) DO UPDATE SET level = EXCLUDED.level, updated_at = NOW()
       RETURNING id, name, level`,
      [req.user.id, name, normalized_name, level]
    );
    res.json({ data: { ...upsertRes.rows[0], origin: 'ai_generated', verified: false, is_custom: true } });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: e.errors } });
    next(e);
  }
});

router.get('/me/custom', authenticate, async (req, res, next) => {
  try {
    const customSkillsRes = await pool.query('SELECT id, name, level FROM user_custom_skills WHERE user_id = $1', [req.user.id]);
    const customSkills = customSkillsRes.rows.map(s => ({ ...s, origin: 'ai_generated', verified: false, is_custom: true, category: 'AI Suggested' }));
    res.json({ data: customSkills });
  } catch (e) {
    next(e);
  }
});

router.delete('/me/custom/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await pool.query('DELETE FROM user_custom_skills WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: e.errors } });
    next(e);
  }
});

router.put('/me', authenticate, async (req, res, next) => {
  try {
    const body = z.object({ skills: z.array(z.object({ skill_id: z.string().uuid(), level: z.enum(['beginner','intermediate','advanced','expert','unknown']).default('beginner'), years_experience: z.number().min(0).nullable().optional(), verified: z.boolean().optional() })) }).parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_skills WHERE user_id = $1', [req.user.id]);
      
      const seen = new Set();
      const uniqueSkills = body.skills.filter(s => {
        if (seen.has(s.skill_id)) return false;
        seen.add(s.skill_id);
        return true;
      });

      for (const skill of uniqueSkills) {
        await client.query(
          `INSERT INTO user_skills (user_id, skill_id, level, years_experience, verified) 
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (user_id, skill_id) DO UPDATE SET level = EXCLUDED.level, years_experience = EXCLUDED.years_experience, verified = EXCLUDED.verified`, 
          [req.user.id, skill.skill_id, skill.level, skill.years_experience ?? null, skill.verified ?? false]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.code === '23503') { // Foreign Key Violation
        return res.status(400).json({ error: { code: 'INVALID_SKILL', message: 'One or more provided skill IDs do not exist.' } });
      }
      throw e;
    } finally {
      client.release();
    }
    res.json({ data: await getUserSkills(req.user.id) });
  } catch (e) { next(e); }
});

router.post('/gap-analysis', authenticate, async (req, res, next) => {
  try {
    const { target_career_id, target_ai_career_id } = gapSchema.parse(req.body);
    let data;
    if (target_career_id) {
      const career = await pool.query(`SELECT id, title FROM careers WHERE id = $1 AND record_status = 'published'`, [target_career_id]);
      if (!career.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Career not found.' } });
      data = await calculateSkillGap(req.user.id, target_career_id);
      data.career_title = career.rows[0].title;
    } else {
      data = await calculateAiSkillGap(req.user.id, target_ai_career_id);
    }

    const profileRes = await pool.query(`SELECT career_goal, education, experience, interests FROM user_profiles WHERE user_id = $1`, [req.user.id]);
    const profile = profileRes.rows[0] || {};

    try {
      const gapController = new AbortController();
      const gapTimeout = setTimeout(() => gapController.abort(), 8000);
      try {
        const aiRes = await fetch(`${env.AI_SERVICE_URL}/internal/v1/skills/gap-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN },
          body: JSON.stringify({
            career: { id: target_career_id || target_ai_career_id, title: data.career_title },
            matched_skills: data.matched_skills,
            missing_skills: data.missing_skills,
            required_skills: [...data.matched_skills, ...data.missing_skills],
            profile: profile
          }),
          signal: gapController.signal
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          data.explanation = aiData.explanation;
        }
      } finally {
        clearTimeout(gapTimeout);
      }
    } catch (e) {
      // AI explanation is enhancement-only — log non-fatally and return base gap data
      import('../../utils/logger.js').then(({ logger }) =>
        logger.warn('[AI Gap Analysis] Request failed', { userId: req.user.id, careerId: target_career_id || target_ai_career_id, message: e.message })
      ).catch(() => {});
    }

    // Gap Analysis persistence has been removed because no downstream consumer queries it,
    // and the previous implementation incorrectly inserted career IDs into the opportunity_id column.

    return res.json({ data });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: e.errors } });
    if (e.message === "AI career not found") return res.status(404).json({ error: { code: 'NOT_FOUND', message: e.message } });
    next(e); 
  }
});
export default router;
