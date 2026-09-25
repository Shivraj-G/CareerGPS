import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_EXPIRES_IN
  });
}

export async function register({ email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       RETURNING id, email, role, account_status, created_at, updated_at`,
      [email, passwordHash]
    );
    const user = userResult.rows[0];
    await client.query('INSERT INTO user_profiles (user_id) VALUES ($1)', [user.id]);
    await client.query('COMMIT');
    return { user, accessToken: signAccessToken(user) };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      const conflict = new Error('An account with this email already exists.');
      conflict.statusCode = 409;
      conflict.code = 'EMAIL_ALREADY_EXISTS';
      throw conflict;
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function login({ email, password }) {
  const result = await pool.query(
    `SELECT id, email, password_hash, role, account_status, created_at, updated_at
     FROM users WHERE email = $1`,
    [email]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }
  if (user.account_status !== 'active') {
    const error = new Error('This account is not active.');
    error.statusCode = 403;
    error.code = 'ACCOUNT_NOT_ACTIVE';
    throw error;
  }
  delete user.password_hash;
  return { user, accessToken: signAccessToken(user) };
}
