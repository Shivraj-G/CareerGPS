import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requirementSchema } from './eligibility.validation.js';
import { listRequirements, addRequirement } from './eligibility.service.js';

const publicRouter = Router();
const adminRouter = Router();

publicRouter.get('/:opportunityId/requirements', async (req, res, next) => {
  try {
    const data = await listRequirements(req.params.opportunityId);
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Opportunity not found.' } });
    res.json({ data });
  } catch (e) { next(e); }
});

adminRouter.post('/:opportunityId/requirements', authenticate, authorize('ADMIN', 'REVIEWER'), async (req, res, next) => {
  try {
    const parsed = requirementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid requirement.' } });
    const data = await addRequirement(req.user, req.params.opportunityId, parsed.data);
    res.status(201).json({ data });
  } catch (e) { next(e); }
});

export { publicRouter as opportunityRequirementRoutes, adminRouter as adminOpportunityRequirementRoutes };
