import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { profileSchema } from './profile.validation.js';
import { getProfile, updateProfile, calculateCompleteness } from './profile.service.js';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';

const router = Router();
router.use(authenticate);

function validate(req, res) {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'The request contains invalid fields.', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) } });
    return null;
  }
  return parsed.data;
}

router.get('/me', async (req, res, next) => {
  try { const profile = await getProfile(req.user.id); if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } }); res.json({ data: profile }); }
  catch (e) { next(e); }
});

router.put('/me', async (req, res, next) => {
  try { const input = validate(req, res); if (!input) return; res.json({ data: await updateProfile(req.user.id, input) }); }
  catch (e) { next(e); }
});

router.get('/me/completeness', async (req, res, next) => {
  try { const profile = await getProfile(req.user.id); if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } }); res.json({ data: calculateCompleteness(profile) }); }
  catch (e) { next(e); }
});

router.post('/me/validate-goal', async (req, res, next) => {
  try {
    const { goal, profileContext } = req.body;
    if (!goal) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Goal is required.' } });
    
    let profile = await getProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } });

    if (profileContext) {
      profile = { ...profile, ...profileContext };
    }

    if (!env.AI_SERVICE_URL) {
      return res.json({
        data: {
          goal,
          classification: "DIRECT_FIT",
          reason: "AI validation unavailable; proceeding with default compatibility.",
          profile_gaps: [],
          suggested_goals: [],
          allow_continue: true,
          ai_generated: false
        }
      });
    }

    // Fetch some careers to guide suggestions with their formal requirements
    const careersResult = await pool.query("SELECT id, title, qualifications, entry_routes FROM careers WHERE record_status = 'published' LIMIT 200");
    const careers = careersResult.rows;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let aiData;
    try {
      const aiRes = await fetch(`${env.AI_SERVICE_URL}/internal/v1/profiles/validate-goal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN },
        body: JSON.stringify({
          goal,
          profile,
          skills: profile.skills || [],
          careers
        }),
        signal: controller.signal
      });
      if (!aiRes.ok) {
        throw new Error('AI Service error');
      }
      aiData = await aiRes.json();
    } catch (err) {
      aiData = {
        goal,
        classification: "DIRECT_FIT",
        reason: "Validation timed out or failed; proceeding.",
        profile_gaps: [],
        suggested_goals: [],
        allow_continue: true,
        ai_generated: false
      };
    } finally {
      clearTimeout(timeoutId);
    }

    res.json({ data: aiData });
  } catch (e) {
    next(e);
  }
});

export default router;
