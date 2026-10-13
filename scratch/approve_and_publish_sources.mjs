import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
const { pool } = await import('../backend/src/config/database.js');
const { publishApprovedCandidatesForSource } = await import('../backend/src/modules/ingestion/ingestion.service.js');

async function main() {
  console.log('--- Step 1: Approve Sprinto in sources table ---');
  const approveRes = await pool.query(
    `UPDATE sources SET is_approved = true, updated_at = NOW() WHERE id = 'f8162916-a111-47b9-a921-46034393009f' RETURNING id, name, is_approved`
  );
  console.log('Approved sources:', approveRes.rows);

  console.log('\n--- Step 2: Publish approved CBES Goa candidates ---');
  const cbesSourceId = 'c5f688a8-4fdd-4f8e-b43c-47f63f22707c';
  const publishResults = await publishApprovedCandidatesForSource(cbesSourceId);
  console.log(`Published CBES candidates count: ${publishResults.length}`);
  console.log('Sample results:', publishResults.slice(0, 5));

  console.log('\n--- Step 3: Check opportunities table ---');
  const countRes = await pool.query(`SELECT count(*), record_status FROM opportunities GROUP BY record_status`);
  console.table(countRes.rows);

  const byTypeRes = await pool.query(`SELECT opportunity_type, count(*) FROM opportunities WHERE record_status = 'published' GROUP BY opportunity_type`);
  console.table(byTypeRes.rows);

  await pool.end();
}

main().catch(console.error);
