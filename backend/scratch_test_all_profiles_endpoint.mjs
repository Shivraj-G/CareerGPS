import { pool } from './src/config/database.js';
import { getProfile, calculateCompleteness } from './src/modules/profiles/profile.service.js';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { env } from './src/config/env.js';
import { createApp } from './src/app.js';

const app = createApp();

async function checkAll() {
  try {
    const allUsers = await pool.query(`SELECT id, email FROM users`);
    console.log(`Found ${allUsers.rows.length} users`);
    for (const u of allUsers.rows) {
      console.log(`Checking user ${u.email} (${u.id})...`);
      try {
        const prof = await getProfile(u.id);
        console.log(`  Profile found? ${Boolean(prof)}`);
        if (prof) {
          const comp = calculateCompleteness(prof);
          console.log(`  Completeness: ${comp.percentage}%`);
        }
      } catch (err) {
        console.error(`  getProfile error for ${u.email}:`, err);
      }

      const token = jwt.sign(
        { sub: u.id, role: 'user', email: u.email },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${token}`);
      console.log(`  GET /api/v1/profiles/me HTTP status: ${res.status}`);
      if (res.status !== 200) {
        console.log(`  Body:`, res.body);
      }
    }
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await pool.end();
  }
}

checkAll();
