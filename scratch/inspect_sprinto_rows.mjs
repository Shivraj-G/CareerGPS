import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';

async function main() {
  const res = await pool.query(`
    SELECT id, title, organization, location, advertisement_number, source_url,
           application_opening, application_deadline, vacancies_total, description, created_at
    FROM opportunities
    WHERE title = 'Software Test Engineer' AND organization = 'Sprinto'
    ORDER BY created_at
  `);
  console.log('Sprinto Software Test Engineer rows count:', res.rows.length);
  console.log('First row:', JSON.stringify(res.rows[0], null, 2));
  console.log('Last row:', JSON.stringify(res.rows[res.rows.length - 1], null, 2));

  // Check if foreign keys reference these IDs:
  const ids = res.rows.map(r => r.id);
  const reqCount = await pool.query(`SELECT COUNT(*) FROM opportunity_requirements WHERE opportunity_id = ANY($1)`, [ids]);
  const careerCount = await pool.query(`SELECT COUNT(*) FROM career_opportunities WHERE opportunity_id = ANY($1)`, [ids]);
  const eligCount = await pool.query(`SELECT COUNT(*) FROM eligibility_checks WHERE opportunity_id = ANY($1)`, [ids]);
  const savedCount = await pool.query(`SELECT count(*) FROM information_schema.tables WHERE table_name = 'saved_opportunities' OR table_name = 'saved_items'`);

  console.log('Foreign key references in opportunity_requirements:', reqCount.rows[0].count);
  console.log('Foreign key references in career_opportunities:', careerCount.rows[0].count);
  console.log('Foreign key references in eligibility_checks:', eligCount.rows[0].count);

  await pool.end();
}

main().catch(console.error);
