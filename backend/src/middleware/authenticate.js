import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../config/database.js';

export async function authenticate(req, res, next) {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
  }

  const token = header.slice(7).trim();
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!payload.sub || typeof payload.role !== 'string') throw new Error('Invalid claims');
  } catch {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'The access token is invalid or expired.' } });
  }

  try {
    const userRes = await pool.query(
      'SELECT id, role, account_status FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = userRes.rows[0];
    
    if (!user) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'The user associated with this token no longer exists.' } });
    }
    if (user.account_status !== 'active') {
      return res.status(403).json({ error: { code: 'ACCOUNT_NOT_ACTIVE', message: 'This account is not active.' } });
    }

    req.user = { id: user.id, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
}
