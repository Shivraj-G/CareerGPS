import { Router } from 'express';
import { pool } from '../../config/database.js';
import { authenticate } from '../../middleware/authenticate.js';

import { env } from '../../config/env.js';
import { z } from 'zod';

const router = Router();
const inFlightPathways = new Map();
router.use(authenticate);

const uuidSchema = z.object({ id: z.string().uuid() });

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = uuidSchema.parse(req.params);
    const result = await pool.query(
      `SELECT id as ai_career_id, title, description, responsibilities, qualifications, entry_routes,
              required_skills, related_careers, goa_relevance, status, pathway_draft
       FROM ai_career_profiles WHERE id = $1 AND status <> 'archived'`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'AI Career not found' } });
    res.json({ data: { ...result.rows[0], origin: 'ai_generated', verified: false } });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID' } });
    next(e);
  }
});

router.post('/:id/save', async (req, res, next) => {
  try {
    const { id } = uuidSchema.parse(req.params);
    await pool.query(
      `INSERT INTO user_ai_career_saves (user_id, ai_career_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, id]
    );
    res.json({ success: true });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID' } });
    next(e);
  }
});

router.delete('/:id/save', async (req, res, next) => {
  try {
    const { id } = uuidSchema.parse(req.params);
    await pool.query(
      `DELETE FROM user_ai_career_saves WHERE user_id = $1 AND ai_career_id = $2`,
      [req.user.id, id]
    );
    res.json({ success: true });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID' } });
    next(e);
  }
});

router.get('/:id/pathway', async (req, res, next) => {
  try {
    const { id } = uuidSchema.parse(req.params);
    const careerRes = await pool.query(`SELECT title, pathway_draft FROM ai_career_profiles WHERE id = $1 AND status <> 'archived'`, [id]);
    if (!careerRes.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'AI Career not found' } });
    
    let draft = careerRes.rows[0].pathway_draft;
    
    if (!draft) {
      if (inFlightPathways.has(id)) {
        try {
          draft = await inFlightPathways.get(id);
        } catch (e) {
          if (e.status) return res.status(e.status).json({ error: { code: e.code, message: e.message } });
          throw e;
        }
      } else {
        const genPromise = (async () => {
          const profileResult = await pool.query(`SELECT education, experience, interests, career_goal FROM user_profiles WHERE user_id = $1`, [req.user.id]);
          const profile = profileResult.rows[0] ?? {};
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 25000);
          try {
            const aiRes = await fetch(`${env.AI_SERVICE_URL}/internal/v1/pathways/draft`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN },
              body: JSON.stringify({
                career_title: careerRes.rows[0].title,
                goal: profile.career_goal || null,
                profile: { education: profile.education || [], experience: profile.experience || [], interests: profile.interests || [] }
              }),
              signal: controller.signal
            });
            
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              if (aiData.status === 'ai_generated' && aiData.pathway) {
                const newDraft = aiData.pathway;
                await pool.query(
                  `UPDATE ai_career_profiles SET pathway_draft = $1 WHERE id = $2 AND pathway_draft IS NULL`,
                  [JSON.stringify(newDraft), id]
                );
                return newDraft;
              } else {
                 throw new Error('AI service did not return a generated pathway.');
              }
            } else {
               throw new Error(`AI service returned ${aiRes.status}`);
            }
          } catch (e) {
             console.error('[AI Pathway] Generation failed:', e);
             const err = new Error('Failed to generate pathway right now. Please try again later.');
             err.code = 'AI_SERVICE_UNAVAILABLE';
             err.status = 503;
             throw err;
          } finally {
            clearTimeout(timeout);
          }
        })();

        inFlightPathways.set(id, genPromise);
        try {
          draft = await genPromise;
        } catch (e) {
          if (e.status) return res.status(e.status).json({ error: { code: e.code, message: e.message } });
          throw e;
        } finally {
          inFlightPathways.delete(id);
        }
      }
    }
    
    const saveRes = await pool.query(`SELECT pathway_progress FROM user_ai_career_saves WHERE user_id = $1 AND ai_career_id = $2`, [req.user.id, id]);
    const progress = saveRes.rows[0]?.pathway_progress || [];
    
    res.json({ data: { ...draft, progress } });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID' } });
    next(e);
  }
});

const progressSchema = z.object({
  steps: z.array(z.number().int().min(1)).max(100)
});

router.post('/:id/pathway/progress', async (req, res, next) => {
  try {
    const { id } = uuidSchema.parse(req.params);
    const { steps } = progressSchema.parse(req.body);
    
    const careerRes = await pool.query(`SELECT pathway_draft FROM ai_career_profiles WHERE id = $1 AND status <> 'archived'`, [id]);
    if (!careerRes.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'AI Career not found' } });
    
    const maxSteps = careerRes.rows[0].pathway_draft?.steps?.length || 0;
    const validSteps = steps.filter(s => s <= maxSteps);
    
    await pool.query(
      `INSERT INTO user_ai_career_saves (user_id, ai_career_id, pathway_progress)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, ai_career_id) DO UPDATE SET pathway_progress = EXCLUDED.pathway_progress`,
      [req.user.id, id, JSON.stringify(validSteps)]
    );
    
    res.json({ data: validSteps });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid Input', details: e.errors } });
    next(e);
  }
});

export default router;
