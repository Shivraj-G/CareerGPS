import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';

async function main() {
  const sprintoIds = (await pool.query(`SELECT id FROM opportunities WHERE title = 'Software Test Engineer' AND organization = 'Sprinto'`)).rows.map(r => r.id);
  const elig = await pool.query(`SELECT * FROM eligibility_checks WHERE opportunity_id = ANY($1)`, [sprintoIds]);
  console.log('Eligibility checks for Sprinto:', JSON.stringify(elig.rows, null, 2));
  await pool.end();
}

main().catch(console.error);
