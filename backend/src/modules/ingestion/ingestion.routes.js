import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requireInternalService } from '../../middleware/internalService.js';
import { validate } from '../../middleware/validate.js';
import {
  sourceCreateSchema, sourcePatchSchema, runCreateSchema, candidateSubmitSchema,
  runStatusSchema, candidateReviewSchema, auditQuerySchema, publishSchema
} from './ingestion.validation.js';
import {
  listSources, createSource, updateSource, createRun, listRuns, getRun,
  submitCandidate, updateRunStatus, listReviewQueue, getCandidate, reviewCandidate,
  publishInternal, listAuditLogs
} from './ingestion.service.js';

const admin = Router();
admin.use(authenticate, authorize('ADMIN', 'REVIEWER'));

admin.get('/sources', async (_req, res, next) => {
  try { res.json({ data: await listSources() }); } catch (e) { next(e); }
});

admin.post('/sources', authorize('ADMIN'), validate(sourceCreateSchema), async (req, res, next) => {
  try { res.status(201).json({ data: await createSource(req.user, req.body) }); } catch (e) { next(e); }
});

admin.patch('/sources/:sourceId', authorize('ADMIN'), validate(sourcePatchSchema), async (req, res, next) => {
  try { res.json({ data: await updateSource(req.user, req.params.sourceId, req.body) }); } catch (e) { next(e); }
});

admin.post('/ingestion/runs', validate(runCreateSchema), async (req, res, next) => {
  try { res.status(201).json({ data: await createRun(req.user, req.body.source_id) }); } catch (e) { next(e); }
});

admin.get('/ingestion/runs', async (req, res, next) => {
  try { res.json({ data: await listRuns({ sourceId: req.query.source_id }) }); } catch (e) { next(e); }
});

admin.get('/ingestion/runs/:runId', async (req, res, next) => {
  try { res.json({ data: await getRun(req.params.runId) }); } catch (e) { next(e); }
});

admin.get('/review-queue', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
    res.json({ data: await listReviewQueue({ status: req.query.status ?? 'needs_review', entityType: req.query.entity_type, page, limit }) });
  } catch (e) { next(e); }
});

admin.get('/review-queue/:candidateId', async (req, res, next) => {
  try { res.json({ data: await getCandidate(req.params.candidateId) }); } catch (e) { next(e); }
});

admin.post('/review-queue/:candidateId/approve', validate(candidateReviewSchema), async (req, res, next) => {
  try { res.json({ data: await reviewCandidate(req.user, req.params.candidateId, 'approve', req.body.review_notes) }); } catch (e) { next(e); }
});

admin.post('/review-queue/:candidateId/reject', validate(candidateReviewSchema), async (req, res, next) => {
  try { res.json({ data: await reviewCandidate(req.user, req.params.candidateId, 'reject', req.body.review_notes) }); } catch (e) { next(e); }
});

admin.post('/review-queue/:candidateId/request-review', validate(candidateReviewSchema), async (req, res, next) => {
  try { res.json({ data: await reviewCandidate(req.user, req.params.candidateId, 'request-review', req.body.review_notes) }); } catch (e) { next(e); }
});

admin.get('/audit-log', async (req, res, next) => {
  try {
    // Query validation middleware reads req.body, so parse query explicitly here.
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid audit filters.', details: parsed.error.issues } });
    res.json(await listAuditLogs(parsed.data));
  } catch (e) { next(e); }
});

const internal = Router();
internal.use(requireInternalService);
internal.post('/candidates', validate(candidateSubmitSchema), async (req, res, next) => {
  try { res.status(201).json({ data: await submitCandidate(req.body) }); } catch (e) { next(e); }
});
internal.post('/runs/:runId/status', validate(runStatusSchema), async (req, res, next) => {
  try { res.json({ data: await updateRunStatus(req.params.runId, req.body) }); } catch (e) { next(e); }
});
internal.post('/publish', validate(publishSchema), async (req, res, next) => {
  try { res.json({ data: await publishInternal(req.body.candidate_id, { service: 'ingestion-worker' }) }); } catch (e) { next(e); }
});

export { admin as adminIngestionRoutes, internal as internalIngestionRoutes };
