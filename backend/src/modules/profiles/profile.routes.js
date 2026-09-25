import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { profileSchema } from './profile.validation.js';
import { getProfile, updateProfile, calculateCompleteness } from './profile.service.js';

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

export default router;
