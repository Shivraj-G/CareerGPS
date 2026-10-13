import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';
import { submitCandidate, createRun } from '../backend/src/modules/ingestion/ingestion.service.js';

async function main() {
  const sourceRes = await pool.query(`SELECT id FROM sources WHERE name ILIKE '%Sprinto%' LIMIT 1`);
  const sourceId = sourceRes.rows[0].id;
  await pool.query(`UPDATE ingestion_runs SET status = 'completed' WHERE source_id = $1 AND status IN ('started', 'running')`, [sourceId]);
  const run = await createRun({ id: null }, sourceId);

  const testUrl = `https://jobs.lever.co/Sprinto/test-job-${Date.now()}`;
  const initialPayload = {
    run_id: run.id,
    source_id: sourceId,
    document: {
      url: testUrl,
      document_title: 'Software Test Engineer',
      content_hash: 'initial_hash_123',
      raw_text: 'Initial job posting without deadline',
      extraction_version: 'test-v1'
    },
    candidate: {
      entity_type: 'opportunity',
      candidate_data: {
        title: 'Software Test Engineer',
        organization: 'Sprinto',
        opportunity_type: 'private_job',
        location: 'Bengaluru',
        source_url: testUrl,
        description: 'Short initial description',
        status: 'open'
      },
      extraction_status: 'needs_review'
    }
  };

  const res = await submitCandidate(initialPayload);
  console.log('Result of submitCandidate:', res);
  await pool.end();
}

main().catch(console.error);
