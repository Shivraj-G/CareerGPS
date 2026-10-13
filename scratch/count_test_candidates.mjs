import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';

async function main() {
  const res = await pool.query(`
    SELECT count(*) FROM ingestion_candidates
    WHERE candidate_data->>'source_url' LIKE '%test-job%'
  `);
  console.log('test-job candidates count in DB:', res.rows[0].count);

  const nonTest = await pool.query(`
    SELECT count(*) FROM ingestion_candidates
    WHERE candidate_data->>'source_url' NOT LIKE '%test-job%'
  `);
  console.log('non-test candidates count in DB:', nonTest.rows[0].count);

  await pool.end();
}

main().catch(console.error);
