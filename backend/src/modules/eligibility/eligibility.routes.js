import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { eligibilityCheckSchema, requirementSchema } from './eligibility.validation.js';
import { checkEligibility, getEligibilityCheck, listRequirements, addRequirement, explainEligibilityWithAi } from './eligibility.service.js';

const router = Router();

router.post('/check', authenticate, async (req, res, next) => {
  try {
    const parsed = eligibilityCheckSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request.' } });
    const data = await checkEligibility(req.user.id, parsed.data.opportunity_id);
    const explanation = await explainEligibilityWithAi(data);
    if (explanation) data.explanation = explanation.explanation ?? null;
    res.status(201).json({ data });
  } catch (e) { next(e); }
});

router.get('/checks/:checkId', authenticate, async (req, res, next) => {
  try {
    const data = await getEligibilityCheck(req.user.id, req.params.checkId);
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Eligibility check not found.' } });
    const explanation = await explainEligibilityWithAi(data);
    if (explanation) data.explanation = explanation.explanation ?? null;
    res.json({ data });
  } catch (e) { next(e); }
});

export default router;
