import { pool } from './src/config/database.js';
import bcrypt from 'bcryptjs';

async function run() {
  try {
    const email = 'test3@example.com';
    const password = await bcrypt.hash('password123', 10);
    const res = await pool.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id', [email, password, 'user']);
    const userId = res.rows[0].id;
    await pool.query('INSERT INTO user_profiles (user_id, profile_status) VALUES ($1, $2)', [userId, 'draft']);
    console.log('Created user:', userId);
    
    // sign a token to use with curl
    const jwt = await import('jsonwebtoken');
    const { env } = await import('./src/config/env.js');
    const token = jwt.default.sign({ sub: userId, role: 'user' }, env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
    console.log('Token:', token);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
