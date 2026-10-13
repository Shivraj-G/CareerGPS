import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import {
  recommendationQuerySchema,
  startProjectSchema,
  updateTaskProgressSchema,
  addDeliverableSchema,
  submitProjectSchema,
  updateProjectStatusSchema
} from './project.validation.js';
import {
  getProjectRecommendations,
  startProject,
  getUserProjects,
  getUserProjectById,
  updateTaskProgress,
  addDeliverable,
  removeDeliverable,
  submitProject,
  updateProjectStatus
} from './project.service.js';

const router = Router();

/**
 * Optional authentication middleware for recommendation endpoint
 * Allows both unauthenticated browsing and authenticated personalized ranking.
 */
function optionalAuthenticate(req, _res, next) {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return next();
  }
  try {
    const token = header.slice(7).trim();
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.sub) {
      req.user = { id: payload.sub, role: payload.role };
    }
  } catch {
    // Proceed as unauthenticated guest if token is expired/invalid
  }
  return next();
}

/**
 * GET /api/v1/projects/recommendations
 * Recommends 3 tiers (Starter, Practical, Career-Ready) of projects.
 * Incorporates user profile, skills, experience, and pathway state.
 */
router.get('/recommendations', optionalAuthenticate, async (req, res, next) => {
  try {
    const parsedQuery = recommendationQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters for project recommendations.',
          details: parsedQuery.error.format()
        }
      });
    }

    const careerId = parsedQuery.data.career_id || parsedQuery.data.careerId || null;
    const careerTitle = parsedQuery.data.career_title || parsedQuery.data.careerTitle || null;
    const forceRefresh = parsedQuery.data.force_refresh === 'true' || parsedQuery.data.forceRefresh === 'true';
    const level = parsedQuery.data.level || null;

    const recommendations = await getProjectRecommendations({
      careerId,
      careerTitle,
      userId: req.user?.id || null,
      forceRefresh,
      level
    });

    return res.json({
      data: recommendations
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * All remaining endpoints require authentication
 */
router.use(authenticate);

/**
 * GET /api/v1/projects/my
 * Lists active, submitted, completed, and archived projects for authenticated user.
 */
router.get('/my', async (req, res, next) => {
  try {
    const status = req.query.status || null;
    const careerId = req.query.career_id || null;
    const projects = await getUserProjects(req.user.id, { status, careerId });
    return res.json({ data: projects });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/projects/:id
 * Fetches workspace details for a specific user project.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const project = await getUserProjectById(req.user.id, req.params.id);
    if (!project) {
      return res.status(404).json({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found or unauthorized.' }
      });
    }
    return res.json({ data: project });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/projects/start
 * Starts or activates a project from recommendations or career project ID.
 * Idempotent: returns existing project if already started.
 */
router.post('/start', async (req, res, next) => {
  try {
    const parsed = startProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body to start project.',
          details: parsed.error.format()
        }
      });
    }

    const project = await startProject(req.user.id, parsed.data);
    return res.status(201).json({ data: project });
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /api/v1/projects/:id/tasks
 * Updates step-by-step checklist task completion in the project workspace.
 */
router.patch('/:id/tasks', async (req, res, next) => {
  try {
    const parsed = updateTaskProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid task progress data.',
          details: parsed.error.format()
        }
      });
    }

    const project = await updateTaskProgress(req.user.id, req.params.id, parsed.data);
    return res.json({ data: project });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/projects/:id/deliverables
 * Adds an artifact or link deliverable with strict URL format verification.
 */
router.post('/:id/deliverables', async (req, res, next) => {
  try {
    const parsed = addDeliverableSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid deliverable details or URL format.',
          details: parsed.error.format()
        }
      });
    }

    const project = await addDeliverable(req.user.id, req.params.id, parsed.data);
    return res.json({ data: project });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/v1/projects/:id/deliverables/:deliverableIndex
 * Removes a deliverable from a project draft.
 */
router.delete('/:id/deliverables/:deliverableIndexOrId', async (req, res, next) => {
  try {
    const target = req.params.deliverableIndexOrId;
    const project = await removeDeliverable(req.user.id, req.params.id, target);
    return res.json({ data: project });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/projects/:id/submit
 * Submits and completes a project, saving reflection, recording evidence in user_skills,
 * and linking to the career pathway milestone.
 */
router.post('/:id/submit', async (req, res, next) => {
  try {
    const parsed = submitProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Submission validation failed. Please check deliverables and reflection.',
          details: parsed.error.format()
        }
      });
    }

    const result = await submitProject(req.user.id, req.params.id, parsed.data);
    return res.json({ data: result });
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /api/v1/projects/:id/status
 * Updates project lifecycle status (e.g. pause/resume/archive).
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const parsed = updateProjectStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid status update.',
          details: parsed.error.format()
        }
      });
    }

    const project = await updateProjectStatus(req.user.id, req.params.id, parsed.data.status);
    return res.json({ data: project });
  } catch (err) {
    return next(err);
  }
});

export default router;
