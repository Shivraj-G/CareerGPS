import { pool } from './src/config/database.js';
import bcrypt from 'bcryptjs';

const hash = await bcrypt.hash('password', 12);
await pool.query("UPDATE users SET password_hash=$1 WHERE email='user@careergps.local'", [hash]);
const r = await pool.query("SELECT id, email FROM users WHERE email='user@careergps.local'");
console.log('Updated:', r.rows[0]);
process.exit(0);
