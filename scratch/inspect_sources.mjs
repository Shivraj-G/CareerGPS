import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';

async function main() {
  const sources = await pool.query(`SELECT * FROM sources`);
  console.log('Sources in DB:', sources.rows.length);
  console.log(JSON.stringify(sources.rows, null, 2));
  await pool.end();
}

main().catch(console.error);
