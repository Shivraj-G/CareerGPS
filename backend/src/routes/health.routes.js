import { Router } from 'express';
import { checkDatabase } from '../config/database.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const database = await checkDatabase();
    res.status(database ? 200 : 503).json({
      status: database ? 'ok' : 'degraded',
      service: 'goa-career-intelligence-backend',
      version: '0.1.0',
      checks: { database: database ? 'ok' : 'failed' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export default router;
