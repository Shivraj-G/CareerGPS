import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('--- Starting migration 021 dry run ---');

    // 1. Add column dedup_key to opportunities
    await client.query(`
      ALTER TABLE opportunities
      ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(128);
    `);

    // 2. Add column dedup_key to ingestion_candidates
    await client.query(`
      ALTER TABLE ingestion_candidates
      ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(128);
    `);

    // 3. Populate dedup_key on opportunities
    await client.query(`
      UPDATE opportunities
      SET dedup_key = CASE
        WHEN advertisement_number IS NOT NULL AND TRIM(advertisement_number) <> '' THEN
          'ad:' || SUBSTRING(encode(sha256((LOWER(TRIM(organization)) || '::' || LOWER(TRIM(advertisement_number)))::bytea), 'hex') FROM 1 FOR 32)
        ELSE
          'fp:' || SUBSTRING(encode(sha256((
            COALESCE(source_id::text, 'no-src') || '::' ||
            LOWER(TRIM(organization)) || '::' ||
            LOWER(TRIM(title)) || '::' ||
            LOWER(TRIM(COALESCE(location, ''))) ||
            CASE
              WHEN application_opening IS NOT NULL THEN '::cycle:' || TO_CHAR(application_opening AT TIME ZONE 'UTC', 'YYYY-MM')
              ELSE ''
            END
          )::bytea), 'hex') FROM 1 FOR 32)
      END;
    `);

    // 4. Populate dedup_key on ingestion_candidates
    await client.query(`
      UPDATE ingestion_candidates
      SET dedup_key = CASE
        WHEN (candidate_data->>'advertisement_number') IS NOT NULL AND TRIM(candidate_data->>'advertisement_number') <> '' THEN
          'ad:' || SUBSTRING(encode(sha256((LOWER(TRIM(COALESCE(candidate_data->>'organization', ''))) || '::' || LOWER(TRIM(candidate_data->>'advertisement_number')))::bytea), 'hex') FROM 1 FOR 32)
        ELSE
          'fp:' || SUBSTRING(encode(sha256((
            COALESCE((SELECT r.source_id::text FROM ingestion_runs r WHERE r.id = ingestion_candidates.run_id), 'no-src') || '::' ||
            LOWER(TRIM(COALESCE(candidate_data->>'organization', ''))) || '::' ||
            LOWER(TRIM(COALESCE(candidate_data->>'title', ''))) || '::' ||
            LOWER(TRIM(COALESCE(candidate_data->>'location', ''))) ||
            CASE
              WHEN (candidate_data->>'application_opening') IS NOT NULL AND candidate_data->>'application_opening' ~ '^\\d{4}-\\d{2}' THEN
                '::cycle:' || SUBSTRING(candidate_data->>'application_opening' FROM 1 FOR 7)
              ELSE ''
            END
          )::bytea), 'hex') FROM 1 FOR 32)
      END;
    `);

    // 5. Clean up duplicate opportunities, re-pointing foreign keys to canonical record
    // Find duplicate groups
    const dupGroups = await client.query(`
      SELECT dedup_key, COUNT(*) as cnt,
             ARRAY_AGG(id ORDER BY created_at ASC, id ASC) as ids
      FROM opportunities
      GROUP BY dedup_key
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${dupGroups.rows.length} duplicate groups in opportunities:`);
    for (const group of dupGroups.rows) {
      const canonicalId = group.ids[0];
      const duplicateIds = group.ids.slice(1);
      console.log(`  Dedup key: ${group.dedup_key}, total: ${group.cnt}, canonical: ${canonicalId}, duplicates to remove: ${duplicateIds.length}`);

      // Re-point eligibility_checks
      const eligResult = await client.query(`
        UPDATE eligibility_checks
        SET opportunity_id = $1
        WHERE opportunity_id = ANY($2)
      `, [canonicalId, duplicateIds]);
      if (eligResult.rowCount > 0) {
        console.log(`    Re-pointed ${eligResult.rowCount} eligibility_checks to canonical ${canonicalId}`);
      }

      // Re-point career_opportunities (delete duplicates if canonical already has relation)
      await client.query(`
        DELETE FROM career_opportunities co_dup
        WHERE co_dup.opportunity_id = ANY($2)
          AND EXISTS (
            SELECT 1 FROM career_opportunities co_canon
            WHERE co_canon.opportunity_id = $1 AND co_canon.career_id = co_dup.career_id
          )
      `, [canonicalId, duplicateIds]);

      const coResult = await client.query(`
        UPDATE career_opportunities
        SET opportunity_id = $1
        WHERE opportunity_id = ANY($2)
      `, [canonicalId, duplicateIds]);
      if (coResult.rowCount > 0) {
        console.log(`    Re-pointed ${coResult.rowCount} career_opportunities to canonical ${canonicalId}`);
      }

      // Re-point or delete redundant opportunity_requirements
      // If canonical already has requirements, delete duplicate requirements; otherwise repoint
      const canonReqCount = await client.query(`
        SELECT COUNT(*) FROM opportunity_requirements WHERE opportunity_id = $1
      `, [canonicalId]);

      if (parseInt(canonReqCount.rows[0].count, 10) > 0) {
        const delReq = await client.query(`
          DELETE FROM opportunity_requirements
          WHERE opportunity_id = ANY($1)
        `, [duplicateIds]);
        console.log(`    Deleted ${delReq.rowCount} duplicate opportunity_requirements from duplicates`);
      } else {
        const repointReq = await client.query(`
          UPDATE opportunity_requirements
          SET opportunity_id = $1
          WHERE opportunity_id = ANY($2)
        `, [canonicalId, duplicateIds]);
        console.log(`    Re-pointed ${repointReq.rowCount} opportunity_requirements to canonical ${canonicalId}`);
      }

      // Delete the duplicate opportunities
      const delOpp = await client.query(`
        DELETE FROM opportunities
        WHERE id = ANY($1)
      `, [duplicateIds]);
      console.log(`    Deleted ${delOpp.rowCount} duplicate opportunities`);
    }

    // 6. Make dedup_key NOT NULL and create UNIQUE INDEX
    await client.query(`
      ALTER TABLE opportunities
      ALTER COLUMN dedup_key SET NOT NULL;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_dedup_key
      ON opportunities (dedup_key);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ingestion_candidates_dedup_key
      ON ingestion_candidates (dedup_key);
    `);

    // Verify final counts
    const finalCount = await client.query(`SELECT COUNT(*) FROM opportunities`);
    console.log(`\nFinal opportunities count: ${finalCount.rows[0].count} (Expected: 64)`);

    const dupCheck = await client.query(`
      SELECT dedup_key, COUNT(*) FROM opportunities GROUP BY dedup_key HAVING COUNT(*) > 1
    `);
    console.log(`Duplicate dedup_keys count: ${dupCheck.rows.length} (Expected: 0)`);

    console.log('\nDry run succeeded! Rolling back transaction.');
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Dry run failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
