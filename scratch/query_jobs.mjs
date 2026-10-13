import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';

async function main() {
  const res = await pool.query(`
    SELECT id, title, organization, location, advertisement_number, source_url, application_deadline, vacancies_total
    FROM opportunities
    WHERE title ILIKE '%Tutor%' OR title ILIKE '%Assistant Professor%'
    ORDER BY title
  `);
  console.log('Tutor and Assistant Professor opportunities:', res.rows.length);
  console.log(JSON.stringify(res.rows, null, 2));

  // Also check if there are other opportunities with identical titles from different orgs
  const grouped = await pool.query(`
    SELECT title, COUNT(DISTINCT organization) as org_count, COUNT(*) as total_count,
           ARRAY_AGG(organization) as orgs, ARRAY_AGG(location) as locs
    FROM opportunities
    GROUP BY title
    HAVING COUNT(*) > 1
  `);
  console.log('\nTitles appearing multiple times across all opportunities:');
  console.log(JSON.stringify(grouped.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
