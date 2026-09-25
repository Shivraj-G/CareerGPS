import { Router } from 'express';
import { pool } from '../../config/database.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();
router.use(authenticate);

router.get('/me', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, role, account_status, created_at, updated_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    res.json({ data: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
