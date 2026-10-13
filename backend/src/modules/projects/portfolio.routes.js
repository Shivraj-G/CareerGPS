import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { updatePortfolioSchema } from './project.validation.js';
import {
  getUserPortfolio,
  updateUserPortfolio,
  getPublicPortfolioBySlug
} from './portfolio.service.js';

const router = Router();

/**
 * GET /api/v1/portfolio/public/:shareSlug
 * Public endpoint to view a user's verified portfolio by unique slug.
 * Does not require authentication.
 * Returns only completed projects and sanitized non-private fields.
 */
router.get('/public/:shareSlug', async (req, res, next) => {
  try {
    const portfolio = await getPublicPortfolioBySlug(req.params.shareSlug);
    if (!portfolio) {
      return res.status(404).json({
        error: {
          code: 'PORTFOLIO_NOT_FOUND',
          message: 'The requested portfolio does not exist or has been made private.'
        }
      });
    }
    return res.json({ data: portfolio });
  } catch (err) {
    return next(err);
  }
});

/**
 * Endpoints below require authentication
 */
router.use(authenticate);

/**
 * GET /api/v1/portfolio/me
 * Retrieves authenticated user's portfolio, completed projects, and demonstrated skills.
 */
router.get('/me', async (req, res, next) => {
  try {
    const portfolioData = await getUserPortfolio(req.user.id);
    return res.json({ data: portfolioData });
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /api/v1/portfolio/me
 * Updates portfolio bio, title, links, public sharing toggle, and privacy settings.
 */
router.patch('/me', async (req, res, next) => {
  try {
    const parsed = updatePortfolioSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid portfolio update data.',
          details: parsed.error.format()
        }
      });
    }

    const updated = await updateUserPortfolio(req.user.id, parsed.data);
    return res.json({ data: updated });
  } catch (err) {
    return next(err);
  }
});

export default router;
