import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
const { pool } = await import('../backend/src/config/database.js');

async function main() {
  const total = await pool.query('SELECT count(*) FROM opportunities');
  console.log('Total opportunities:', total.rows[0].count);

  const published = await pool.query("SELECT count(*) FROM opportunities WHERE record_status = 'published'");
  console.log('Published opportunities:', published.rows[0].count);

  const byType = await pool.query('SELECT opportunity_type, count(*) FROM opportunities GROUP BY opportunity_type');
  console.log('Opportunities by type:', byType.rows);

  const sample = await pool.query('SELECT id, title, organization, opportunity_type, location, status, record_status, application_deadline, source_url FROM opportunities LIMIT 10');
  console.table(sample.rows);

  const candidates = await pool.query('SELECT count(*), review_status, extraction_status FROM ingestion_candidates GROUP BY review_status, extraction_status');
  console.log('Ingestion candidates by status:', candidates.rows);

  await pool.end();
}

main().catch(console.error);
