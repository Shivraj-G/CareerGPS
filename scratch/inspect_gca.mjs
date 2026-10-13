import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';

async function main() {
  const res = await pool.query(`
    SELECT id, title, organization, location, advertisement_number, source_url,
           application_opening, application_deadline, description, created_at
    FROM opportunities
    WHERE organization ILIKE '%Goa College of Agriculture%'
  `);
  console.log('Goa College of Agriculture rows:', res.rows.length);
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

main().catch(console.error);
