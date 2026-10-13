import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
const { pool } = await import('../backend/src/config/database.js');

async function main() {
  const res = await pool.query(`
    SELECT c.entity_type, s.name, s.source_type, c.review_status, c.extraction_status, count(*)
    FROM ingestion_candidates c
    JOIN ingestion_runs r ON r.id = c.run_id
    JOIN sources s ON s.id = r.source_id
    GROUP BY c.entity_type, s.name, s.source_type, c.review_status, c.extraction_status
  `);
  console.table(res.rows);

  const sample = await pool.query(`
    SELECT c.id, c.entity_type, c.review_status, s.name, c.candidate_data->>'title' as title,
           c.candidate_data->>'organization' as org, c.candidate_data->>'opportunity_type' as type,
           c.candidate_data->>'source_url' as url
    FROM ingestion_candidates c
    JOIN ingestion_runs r ON r.id = c.run_id
    JOIN sources s ON s.id = r.source_id
    WHERE c.review_status = 'needs_review'
    LIMIT 15
  `);
  console.table(sample.rows);

  await pool.end();
}

main().catch(console.error);
