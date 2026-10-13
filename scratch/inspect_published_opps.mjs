import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
const { pool } = await import('../backend/src/config/database.js');

async function main() {
  const opps = await pool.query(`SELECT id, title, organization, opportunity_type, location, advertisement_number,
    application_opening, application_deadline, vacancies_total, status, verification_status, source_url
    FROM opportunities WHERE record_status = 'published' ORDER BY created_at ASC`);
  console.log(`Published opportunities count: ${opps.rows.length}`);
  for (const r of opps.rows) {
    console.log(`[${r.status}] [${r.opportunity_type}] "${r.title}" | Org: "${r.organization}" | Loc: "${r.location}" | Deadline: ${r.application_deadline} | Source: ${r.source_url}`);
  }
  await pool.end();
}

main().catch(console.error);
