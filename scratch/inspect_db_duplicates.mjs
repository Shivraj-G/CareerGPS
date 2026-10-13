import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';

async function main() {
  const res = await pool.query(`
    SELECT title, organization, location, advertisement_number, COUNT(*) as count,
           ARRAY_AGG(id) as ids,
           ARRAY_AGG(source_url) as urls,
           ARRAY_AGG(created_at) as created_ats
    FROM opportunities
    GROUP BY title, organization, location, advertisement_number
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  console.log('Duplicate groups with exact (title, organization, location, advertisement_number):');
  console.log(JSON.stringify(res.rows, null, 2));

  const byTitleOrg = await pool.query(`
    SELECT title, organization, location, COUNT(*) as count,
           ARRAY_AGG(id) as ids,
           ARRAY_AGG(advertisement_number) as ad_numbers,
           ARRAY_AGG(source_url) as urls
    FROM opportunities
    GROUP BY title, organization, location
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  console.log('\nDuplicate groups by (title, organization, location):');
  console.log(JSON.stringify(byTitleOrg.rows, null, 2));

  const total = await pool.query('SELECT count(*) FROM opportunities');
  console.log('\nTotal opportunities in DB:', total.rows[0].count);

  const candRes = await pool.query(`
    SELECT c.id, c.run_id, c.review_status, c.extraction_status, c.candidate_data->>'title' as title,
           c.candidate_data->>'organization' as organization,
           c.candidate_data->>'source_url' as source_url,
           c.created_at
    FROM ingestion_candidates c
    WHERE c.candidate_data->>'title' ILIKE '%Software Test Engineer%'
    ORDER BY c.created_at
  `);
  console.log('\nIngestion candidates for Software Test Engineer count:', candRes.rows.length);
  console.log('Sample candidates:', JSON.stringify(candRes.rows.slice(0, 5), null, 2));

  const indexes = await pool.query(`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'opportunities';
  `);
  console.log('\nIndexes on opportunities:', indexes.rows);

  const constraints = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'opportunities'::regclass;
  `);
  console.log('\nConstraints on opportunities:', constraints.rows);

  await pool.end();
}

main().catch(console.error);
