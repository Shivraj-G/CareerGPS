import { pool } from './src/config/database.js';
import { getProfile } from './src/modules/profiles/profile.service.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { env } from './src/config/env.js';
import { createApp } from './src/app.js';

const app = createApp();

async function check() {
  const userId = 'b80d3ca7-f78a-40b8-93b4-3ff8df0949da';
  const u = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  console.log('USER:', u.rows[0]);
  const up = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
  console.log('RAW USER PROFILE:', JSON.stringify(up.rows[0], null, 2));

  try {
    const prof = await getProfile(userId);
    console.log('getProfile:', JSON.stringify(prof, null, 2));
  } catch (err) {
    console.error('getProfile ERROR:', err);
  }

  const token = jwt.sign(
    { sub: userId, role: 'user', email: '7896789@gmail.com' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const res = await request(app)
    .get('/api/v1/profiles/me')
    .set('Authorization', `Bearer ${token}`);
  console.log('HTTP status:', res.status);
  console.log('HTTP body:', JSON.stringify(res.body, null, 2));

  await pool.end();
}

check();
