import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { evaluateGoalFeasibility } from './feasibility.engine.js';
import { pool } from '../../config/database.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/v1/goals/current
 * Loads current goal and latest evaluation for the authenticated user.
 */
router.get('/current', async (req, res, next) => {
  try {
    const profileRes = await pool.query(
      `SELECT raw_profile_data, current_career_goal_id FROM profiles WHERE user_id = $1`,
      [req.user.id]
    );

    const profileData = profileRes.rows[0]?.raw_profile_data || {};
    const goalTitle = profileData.target_role || profileData.career_goal || profileData.primary_career_goal || '';

    const evaluation = evaluateGoalFeasibility(profileData, { title: goalTitle });
    res.json({
      data: {
        goal: goalTitle,
        evaluation
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/goals/evaluate or POST /api/v1/goals/:id/evaluate
 * Evaluates goal feasibility across the four dimensions deterministically.
 */
const evaluateHandler = async (req, res, next) => {
  try {
    const goalTitle = req.body?.goal || req.body?.title || req.query?.goal || '';
    const profile = req.body?.profile || {};

    let userProfile = profile;
    if (!userProfile || Object.keys(userProfile).length === 0) {
      const dbRes = await pool.query(
        `SELECT raw_profile_data FROM profiles WHERE user_id = $1`,
        [req.user.id]
      );
      userProfile = dbRes.rows[0]?.raw_profile_data || {};
    }

    const evaluation = evaluateGoalFeasibility(userProfile, {
      id: req.params.id || null,
      title: goalTitle
    });

    res.json({
      data: evaluation
    });
  } catch (err) {
    next(err);
  }
};

router.post('/evaluate', evaluateHandler);
router.post('/:id/evaluate', evaluateHandler);

/**
 * POST /api/v1/goals/suggestions
 * Proposes discovery suggestions when no goal is selected or alternatives are requested.
 */
router.post('/suggestions', async (req, res, next) => {
  try {
    const suggestions = [
      {
        id: 'software_developer',
        label: 'Software Developer / Backend Engineer',
        field: 'Technology & Computing',
        confidence: 'high',
        rationale: 'Strong demand, skills-first hiring friendly, flexible study and remote options.'
      },
      {
        id: 'data_analyst',
        label: 'Data Analyst / Business Intelligence',
        field: 'Analytics & Data',
        confidence: 'high',
        rationale: 'Applies computing and business logic with high part-time and remote flexibility.'
      },
      {
        id: 'health_informatics',
        label: 'Health Informatics & Healthcare Data Specialist',
        field: 'Healthcare & Technology',
        confidence: 'high',
        rationale: 'Combines computing fundamentals with healthcare systems without requiring clinical licensing.'
      },
      {
        id: 'ux_designer',
        label: 'Product / UI-UX Designer',
        field: 'Design & Product',
        confidence: 'medium',
        rationale: 'Emphasizes portfolio case studies and user research.'
      }
    ];

    res.json({
      data: {
        suggestions
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
