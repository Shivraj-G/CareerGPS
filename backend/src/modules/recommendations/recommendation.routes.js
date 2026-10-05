import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { buildRecommendationContext, saveRecommendation } from './recommendation.service.js';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';
const router = Router();
const requestSchema = z.object({ goal: z.string().max(500).optional(), preferred_locations: z.array(z.string().max(100)).max(20).optional(), constraints: z.record(z.string(), z.unknown()).optional() });
async function callAI(context) {
  if (!env.AI_SERVICE_URL) throw Object.assign(new Error('AI service is not configured.'), { statusCode: 503, code: 'AI_SERVICE_UNAVAILABLE' });
  const controller = new AbortController();
  // Recommendations involve complex multi-career analysis; 30s is more realistic than 8s
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${env.AI_SERVICE_URL.replace(/\/$/, '')}/internal/v1/recommendations/careers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(env.INTERNAL_SERVICE_TOKEN ? { 'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN } : {}) },
      body: JSON.stringify(context),
      signal: controller.signal
    });
    if (!response.ok) throw Object.assign(new Error('AI recommendation service failed.'), { statusCode: 502, code: 'AI_SERVICE_ERROR' });
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
router.post('/careers', authenticate, async (req, res, next) => {
  try {
    const input = requestSchema.parse(req.body);
    const context = await buildRecommendationContext(req.user.id, input.goal, { preferred_locations: input.preferred_locations ?? [], constraints: input.constraints ?? {} });
    const ai = await callAI(context);
    
    const finalResults = [];
    if (ai.results) {
      for (const item of ai.results) {
        if (!item.career_id) {
           const normTitle = item.career_title ? item.career_title.toLowerCase().replace(/[^a-z0-9+#]/g, '') : '';
           if (normTitle) {
             const dbHit = await pool.query(`SELECT id FROM careers WHERE record_status = 'published' AND LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9+#]', '', 'g')) = $1 LIMIT 1`, [normTitle]);
             if (dbHit.rows.length > 0) {
                item.career_id = dbHit.rows[0].id;
                item.source = 'database';
             } else {
                const aiDbHit = await pool.query(`SELECT id FROM ai_career_profiles WHERE status <> 'archived' AND normalized_title = $1 LIMIT 1`, [normTitle]);
                if (aiDbHit.rows.length > 0) {
                   item.ai_career_id = aiDbHit.rows[0].id;
                   item.source = 'ai_database';
                }
             }
           }
        }
        finalResults.push(item);
      }
    }

    const saved = await saveRecommendation(req.user.id, context.goal, context.preferences, finalResults);
    res.status(201).json({ data: { recommendation_id: saved.id, results: finalResults } });
  } catch (e) {
    next(e);
  }
});
router.get('/:recommendationId', authenticate, async (req, res, next) => {
  try { const result = await pool.query(`SELECT id, goal, preferences, results, status, created_at FROM recommendations WHERE id = $1 AND user_id = $2`, [req.params.recommendationId, req.user.id]); if (!result.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recommendation not found.' } }); res.json({ data: result.rows[0] }); } catch (e) { next(e); }
});
router.post('/:recommendationId/feedback', authenticate, async (req, res, next) => {
  try { const body = z.object({ rating: z.enum(['helpful','not_helpful']), comment: z.string().max(1000).optional() }).parse(req.body); const exists = await pool.query(`SELECT id FROM recommendations WHERE id = $1 AND user_id = $2`, [req.params.recommendationId, req.user.id]); if (!exists.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recommendation not found.' } }); await pool.query(`INSERT INTO recommendation_feedback (recommendation_id, user_id, rating, comment) VALUES ($1,$2,$3,$4)`, [req.params.recommendationId, req.user.id, body.rating, body.comment ?? null]); res.status(201).json({ data: { saved: true } }); } catch (e) { next(e); }
});
export default router;
