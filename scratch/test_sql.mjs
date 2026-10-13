import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';

async function main() {
  const res = await pool.query(`SELECT encode(sha256('test'::bytea), 'hex') as hash, md5('test') as md5_hash`);
  console.log(res.rows[0]);
  await pool.end();
}

main().catch(console.error);
