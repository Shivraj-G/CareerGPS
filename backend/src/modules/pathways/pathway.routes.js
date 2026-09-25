import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { generatePathwaySchema, progressSchema } from './pathway.validation.js';
import { listPathways, getPathway, generatePathway, getUserPathway, updateProgress, savePathway, unsavePathway } from './pathway.service.js';

const router = Router();
const pagination = (req) => {
  const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit ?? '20', 10) || 20));
  return { page, limit };
};

router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = pagination(req);
    const data = await listPathways({ page, limit, search: typeof req.query.search === 'string' ? req.query.search.trim() : '', careerId: typeof req.query.career_id === 'string' ? req.query.career_id : null });
    res.json(data);
  } catch (e) { next(e); }
});

router.get('/generated/:userPathwayId', authenticate, async (req, res, next) => {
  try {
    const data = await getUserPathway(req.user.id, req.params.userPathwayId);
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personalized pathway not found.' } });
    res.json({ data });
  } catch (e) { next(e); }
});

router.post('/generate', authenticate, async (req, res, next) => {
  try {
    const parsed = generatePathwaySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request.' } });
    const data = await generatePathway(req.user.id, parsed.data);
    res.status(201).json({ data });
  } catch (e) { next(e); }
});

router.get('/:pathwayId/steps', async (req, res, next) => {
  try {
    const data = await getPathway(req.params.pathwayId);
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pathway not found.' } });
    res.json({ data: data.steps });
  } catch (e) { next(e); }
});

router.post('/:pathwayId/progress', authenticate, async (req, res, next) => {
  try {
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request.' } });
    const data = await updateProgress(req.user.id, req.params.pathwayId, parsed.data.steps);
    res.json({ data });
  } catch (e) { next(e); }
});

router.get('/:pathwayId/progress', authenticate, async (req, res, next) => {
  try {
    const data = await getUserPathway(req.user.id, req.params.pathwayId);
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personalized pathway not found.' } });
    res.json({ data: { user_pathway_id: data.id, status: data.status, steps: data.steps } });
  } catch (e) { next(e); }
});

router.post('/:pathwayId/save', authenticate, async (req, res, next) => {
  try {
    const ok = await savePathway(req.user.id, req.params.pathwayId);
    if (!ok) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pathway not found.' } });
    res.status(201).json({ data: { saved: true, pathway_id: req.params.pathwayId } });
  } catch (e) { next(e); }
});

router.delete('/:pathwayId/save', authenticate, async (req, res, next) => {
  try {
    const removed = await unsavePathway(req.user.id, req.params.pathwayId);
    if (!removed) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Saved pathway not found.' } });
    res.status(204).send();
  } catch (e) { next(e); }
});

router.get('/:pathwayId', async (req, res, next) => {
  try {
    const data = await getPathway(req.params.pathwayId);
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pathway not found.' } });
    res.json({ data });
  } catch (e) { next(e); }
});

export default router;
