import { Router } from 'express';
import { getOpportunity, listOpportunities } from './opportunity.service.js';
import { opportunityListQuerySchema } from './opportunity.validation.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const parsed = opportunityListQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid opportunity filters.', details: parsed.error.flatten() } });
    res.json(await listOpportunities(parsed.data));
  } catch (e) { next(e); }
});

router.get('/:opportunityId', async (req, res, next) => {
  try {
    const data = await getOpportunity(req.params.opportunityId);
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Opportunity not found.' } });
    res.json({ data });
  } catch (e) { next(e); }
});

export default router;
