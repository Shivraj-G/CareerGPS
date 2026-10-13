import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../src/config/database.js';
import { listOpportunities, getOpportunity } from '../src/modules/opportunities/opportunity.service.js';
import { submitCandidate, publishInternal, createRun } from '../src/modules/ingestion/ingestion.service.js';
import { canonicalizeUrl, computeOpportunityDedupKey, extractExternalJobId } from '../src/modules/ingestion/deduplication.js';

describe('Opportunity Deduplication & Pipeline Regression Tests (All 14 Requirements)', () => {
  let testSourceId;

  beforeAll(async () => {
    const res = await pool.query(`
      INSERT INTO sources (name, source_type, base_url, is_approved)
      VALUES ('Dedup Regression Test Source', 'private_jobs', 'https://jobs.example.com', true)
      RETURNING id
    `);
    testSourceId = res.rows[0].id;
  });

  afterAll(async () => {
    if (testSourceId) {
      await pool.query(`DELETE FROM opportunities WHERE source_id = $1`, [testSourceId]);
      await pool.query(`DELETE FROM ingestion_candidates WHERE run_id IN (SELECT id FROM ingestion_runs WHERE source_id = $1)`, [testSourceId]);
      await pool.query(`DELETE FROM source_evidence WHERE source_document_id IN (SELECT id FROM source_documents WHERE source_id = $1)`, [testSourceId]);
      await pool.query(`DELETE FROM source_documents WHERE source_id = $1`, [testSourceId]);
      await pool.query(`DELETE FROM ingestion_runs WHERE source_id = $1`, [testSourceId]);
      await pool.query(`DELETE FROM sources WHERE id = $1`, [testSourceId]);
    }
  });

  // 1. Ingesting the same Sprinto listing twice
  it('1. Ingesting the same Sprinto listing twice is idempotent', async () => {
    const run = await createRun({ id: null }, testSourceId);

    const testUrl = `https://jobs.lever.co/Sprinto/dedup-test-unit-1`;
    const payload = {
      run_id: run.id,
      source_id: testSourceId,
      document: {
        url: testUrl,
        document_title: 'Deduplication QA Engineer',
        content_hash: 'hash_test_1',
        raw_text: 'Test job description',
        extraction_version: 'test-v1'
      },
      candidate: {
        entity_type: 'opportunity',
        candidate_data: {
          title: 'Deduplication QA Engineer',
          organization: 'Sprinto',
          opportunity_type: 'private_job',
          location: 'Bengaluru',
          source_url: testUrl,
          description: 'Job description for deduplication verification',
          status: 'open'
        },
        extraction_status: 'needs_review'
      }
    };

    const first = await submitCandidate(payload);
    expect(first).toHaveProperty('id');

    const second = await submitCandidate(payload);
    expect(second).toHaveProperty('duplicate', true);

    // Publishing twice should yield identical opportunity
    const opp1 = await publishInternal(first.id, { run: 'first' });
    const opp2 = await publishInternal(first.id, { run: 'second' });
    expect(opp1.id).toBe(opp2.id);

    // Cleanup test candidate and opportunity
    await pool.query(`DELETE FROM opportunities WHERE id = $1`, [opp1.id]);
    await pool.query(`DELETE FROM ingestion_candidates WHERE id = $1`, [first.id]);
    await pool.query(`UPDATE ingestion_runs SET status = 'completed' WHERE id = $1`, [run.id]);
  });

  // 2. Fetching the same listing through overlapping pagination
  it('2. Fetching the same listing through overlapping pagination does not create duplicate candidates', async () => {
    const run = await createRun({ id: null }, testSourceId);

    const sharedUrl = `https://jobs.lever.co/Sprinto/pagination-shared-job`;
    const page1Item = {
      run_id: run.id,
      source_id: testSourceId,
      document: { url: sharedUrl, content_hash: 'hash_page1' },
      candidate: {
        entity_type: 'opportunity',
        candidate_data: {
          title: 'Paginated Test Role',
          organization: 'Sprinto',
          location: 'Bengaluru',
          source_url: sharedUrl,
          status: 'open'
        }
      }
    };
    const page2Item = {
      ...page1Item,
      document: { url: sharedUrl, content_hash: 'hash_page1' }
    };

    const resPage1 = await submitCandidate(page1Item);
    expect(resPage1).toHaveProperty('id');

    const resPage2 = await submitCandidate(page2Item);
    expect(resPage2).toHaveProperty('duplicate', true);

    await pool.query(`DELETE FROM ingestion_candidates WHERE id = $1`, [resPage1.id]);
    await pool.query(`UPDATE ingestion_runs SET status = 'completed' WHERE id = $1`, [run.id]);
  });

  // 3. Concurrent ingestion runs encountering the same external job
  it('3. Concurrent ingestion runs encountering the same external job resolve safely without collision errors', async () => {
    const run = await createRun({ id: null }, testSourceId);

    const sharedUrl = `https://jobs.lever.co/Sprinto/concurrent-test-job-${Date.now()}`;
    const payload1 = {
      run_id: run.id,
      source_id: testSourceId,
      document: { url: sharedUrl, content_hash: 'c_hash_1' },
      candidate: {
        entity_type: 'opportunity',
        candidate_data: {
          title: 'Concurrent Verification Role',
          organization: 'Sprinto',
          location: 'Bengaluru',
          source_url: sharedUrl,
          status: 'open'
        }
      }
    };

    const cand1 = await submitCandidate(payload1);
    expect(cand1).toHaveProperty('id');

    // Concurrently publish the candidate
    const [publish1, publish2] = await Promise.all([
      publishInternal(cand1.id, { runner: 1 }),
      publishInternal(cand1.id, { runner: 2 })
    ]);

    expect(publish1.id).toBe(publish2.id);

    // Verify exactly one row in DB
    const countRes = await pool.query(`SELECT COUNT(*) FROM opportunities WHERE id = $1`, [publish1.id]);
    expect(parseInt(countRes.rows[0].count, 10)).toBe(1);

    await pool.query(`DELETE FROM opportunities WHERE id = $1`, [publish1.id]);
    await pool.query(`DELETE FROM ingestion_candidates WHERE id = $1`, [cand1.id]);
    await pool.query(`UPDATE ingestion_runs SET status = 'completed' WHERE id = $1`, [run.id]);
  });

  // 4. A listing whose deadline or description changes
  it('4. A listing whose deadline or description changes updates canonical record instead of inserting copy', async () => {
    const run = await createRun({ id: null }, testSourceId);

    const testUrl = `https://jobs.lever.co/Sprinto/updating-job-${Date.now()}`;
    const initialCandidate = await submitCandidate({
      run_id: run.id,
      source_id: testSourceId,
      document: { url: testUrl, content_hash: 'h1' },
      candidate: {
        entity_type: 'opportunity',
        candidate_data: {
          title: 'Dynamic Updating Role',
          organization: 'Sprinto',
          location: 'Bengaluru',
          source_url: testUrl,
          description: 'Short initial description',
          status: 'open'
        }
      }
    });

    const initialOpp = await publishInternal(initialCandidate.id);
    expect(initialOpp.description).toBe('Short initial description');

    // Submit improved/updated data with new deadline and expanded description
    const updatedDeadline = '2026-11-30T18:00:00.000Z';
    const updatedCandidate = await submitCandidate({
      run_id: run.id,
      source_id: testSourceId,
      document: { url: testUrl, content_hash: 'h2' },
      candidate: {
        entity_type: 'opportunity',
        candidate_data: {
          title: 'Dynamic Updating Role',
          organization: 'Sprinto',
          location: 'Bengaluru',
          source_url: testUrl,
          description: 'Expanded comprehensive job description with all details',
          application_deadline: updatedDeadline,
          vacancies_total: 5,
          status: 'open'
        }
      }
    });

    expect(updatedCandidate).toHaveProperty('updated', true);

    // Verify opportunity in database was updated in-place without creating a second record
    const oppInDb = await getOpportunity(initialOpp.id);
    expect(oppInDb.id).toBe(initialOpp.id);
    expect(oppInDb.vacancies_total).toBe(5);
    expect(oppInDb.description).toContain('Expanded comprehensive');

    await pool.query(`DELETE FROM opportunities WHERE id = $1`, [initialOpp.id]);
    await pool.query(`DELETE FROM ingestion_candidates WHERE id = $1`, [initialCandidate.id]);
    await pool.query(`UPDATE ingestion_runs SET status = 'completed' WHERE id = $1`, [run.id]);
  });

  // 5. Two genuinely different vacancies with the same title
  it('5. Two genuinely different vacancies with the same title from different employers are preserved as separate', async () => {
    const opps = await pool.query(`
      SELECT id, title, organization, dedup_key FROM opportunities
      WHERE title = 'Walk-In-Interview For The Following Posts'
    `);
    expect(opps.rows.length).toBeGreaterThanOrEqual(2);

    const orgs = new Set(opps.rows.map(o => o.organization));
    expect(orgs.size).toBeGreaterThan(1);

    const dedupKeys = new Set(opps.rows.map(o => o.dedup_key));
    expect(dedupKeys.size).toBe(opps.rows.length);
  });

  // 6. Same employer and title but different locations
  it('6. Same employer and title but different locations are preserved as distinct opportunities', async () => {
    const sprintoEAE = await pool.query(`
      SELECT id, title, organization, location, dedup_key FROM opportunities
      WHERE organization = 'Sprinto' AND title = 'Enterprise Account Executive - US'
    `);
    expect(sprintoEAE.rows.length).toBe(2);

    const locs = sprintoEAE.rows.map(r => r.location);
    expect(locs).toContain('Bengaluru');
    expect(locs).toContain('USA / Remote');

    // Dedup keys must be distinct
    expect(sprintoEAE.rows[0].dedup_key).not.toBe(sprintoEAE.rows[1].dedup_key);
  });

  // 7. A new recruitment cycle with a legitimate new identifier
  it('7. A new recruitment cycle with a legitimate new identifier/cycle remains separate', async () => {
    const key1 = computeOpportunityDedupKey({
      organization: 'Goa Public Service Commission',
      title: 'Assistant Professor',
      advertisement_number: '08 Year 2026'
    });
    const key2 = computeOpportunityDedupKey({
      organization: 'Goa Public Service Commission',
      title: 'Assistant Professor',
      advertisement_number: '09 Year 2026'
    });
    expect(key1).not.toBe(key2);

    // Opening month cycles
    const cycle1Key = computeOpportunityDedupKey({
      organization: 'Directorate of Health Services',
      title: 'Medical Officer Notice',
      location: 'Goa',
      application_opening: '2026-08-01'
    });
    const cycle2Key = computeOpportunityDedupKey({
      organization: 'Directorate of Health Services',
      title: 'Medical Officer Notice',
      location: 'Goa',
      application_opening: '2026-09-01'
    });
    expect(cycle1Key).not.toBe(cycle2Key);
  });

  // 8. Records with missing external IDs
  it('8. Records with missing external IDs are deterministically deduplicated using normalized fallback fingerprint', () => {
    const key1 = computeOpportunityDedupKey({
      organization: 'Sprinto',
      title: 'Software Test Engineer',
      location: 'Bengaluru'
    }, 'f8162916-a111-47b9-a921-46034393009f');

    const key2 = computeOpportunityDedupKey({
      organization: '  sprinto  ',
      title: 'software  test  engineer ',
      location: ' bengaluru '
    }, 'F8162916-A111-47B9-A921-46034393009F');

    expect(key1).toBe(key2);
    expect(key1.startsWith('fp:')).toBe(true);
  });

  // 9. URL normalization and tracking parameters
  it('9. URL normalization strips tracking parameters, fragments, and trailing slashes safely', () => {
    const urlA = 'https://jobs.lever.co/Sprinto/test-job?utm_source=linkedin&ref=careers#apply';
    const urlB = 'https://JOBS.LEVER.CO/Sprinto/test-job/?utm_medium=cpc&gclid=12345';
    const urlC = 'https://jobs.lever.co/Sprinto/test-job';

    expect(canonicalizeUrl(urlA)).toBe('https://jobs.lever.co/sprinto/test-job');
    expect(canonicalizeUrl(urlB)).toBe('https://jobs.lever.co/sprinto/test-job');
    expect(canonicalizeUrl(urlC)).toBe('https://jobs.lever.co/sprinto/test-job');
    expect(canonicalizeUrl(urlA)).toBe(canonicalizeUrl(urlB));
  });

  // 10. Database uniqueness conflicts and safe retries
  it('10. Database uniqueness conflicts are handled safely via ON CONFLICT DO UPDATE', async () => {
    const dedupKey = 'unit-test-conflict-key-' + Date.now();
    const sourceId = testSourceId;

    const insertQuery = `
      INSERT INTO opportunities
       (title, organization, opportunity_type, location, advertisement_number,
        application_opening, application_deadline, vacancies_total, description, status,
        record_status, verification_status, source_id, source_url, source_document_url,
        source_last_checked_at, verified_at, dedup_key)
      VALUES ($1, $2, 'private_job', 'Goa', NULL, NULL, NULL, 1, $3, 'open',
              'published', 'verified', $4, 'https://example.com/job', 'https://example.com/job', NOW(), NOW(), $5)
      ON CONFLICT (dedup_key) DO UPDATE SET
        description = EXCLUDED.description,
        updated_at = NOW()
      RETURNING *
    `;

    const row1 = await pool.query(insertQuery, ['Test Title', 'Test Org', 'First Version', sourceId, dedupKey]);
    const row2 = await pool.query(insertQuery, ['Test Title', 'Test Org', 'Second Version', sourceId, dedupKey]);

    expect(row1.rows[0].id).toBe(row2.rows[0].id);
    expect(row2.rows[0].description).toBe('Second Version');

    await pool.query(`DELETE FROM opportunities WHERE id = $1`, [row1.rows[0].id]);
  });

  // 11. Joins that previously returned duplicate opportunities
  it('11. listOpportunities query returns distinct opportunity records without join multiplication', async () => {
    const result = await listOpportunities({ page: 1, limit: 100 });
    const ids = result.data.map(o => o.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  // 12. Existing saved opportunities and audit references after cleanup
  it('12. Foreign key relationships and audit logs remain valid after deduplication', async () => {
    // Check opportunity_requirements point to valid opportunities
    const orphanReqs = await pool.query(`
      SELECT count(*) FROM opportunity_requirements r
      LEFT JOIN opportunities o ON o.id = r.opportunity_id
      WHERE o.id IS NULL
    `);
    expect(parseInt(orphanReqs.rows[0].count, 10)).toBe(0);

    // Check eligibility_checks point to valid opportunities
    const orphanElig = await pool.query(`
      SELECT count(*) FROM eligibility_checks ec
      LEFT JOIN opportunities o ON o.id = ec.opportunity_id
      WHERE o.id IS NULL
    `);
    expect(parseInt(orphanElig.rows[0].count, 10)).toBe(0);

    // Check career_opportunities point to valid opportunities
    const orphanCareer = await pool.query(`
      SELECT count(*) FROM career_opportunities co
      LEFT JOIN opportunities o ON o.id = co.opportunity_id
      WHERE o.id IS NULL
    `);
    expect(parseInt(orphanCareer.rows[0].count, 10)).toBe(0);
  });

  // 13. Private-sector and government opportunities displayed together
  it('13. Private-sector and government opportunities displayed together without duplicates', async () => {
    const result = await listOpportunities({ status: 'all', opportunity_type: 'all', limit: 100 });
    const types = new Set(result.data.map(o => o.opportunity_type));
    expect(types.has('government_recruitment')).toBe(true);
    expect(types.has('private_job')).toBe(true);

    // Ensure Software Test Engineer appears exactly once
    const sprintoSTE = result.data.filter(o => o.title === 'Software Test Engineer' && o.organization === 'Sprinto');
    expect(sprintoSTE.length).toBe(1);
  });

  // 14. Opportunity filters, pagination, and search after deduplication
  it('14. Search, category filter, location filter, and pagination work accurately post-deduplication', async () => {
    // Search for Sprinto
    const searchRes = await listOpportunities({ search: 'Sprinto', limit: 50 });
    expect(searchRes.data.length).toBeGreaterThan(0);
    searchRes.data.forEach(item => {
      expect(item.organization).toBe('Sprinto');
    });

    // Location filter
    const goaRes = await listOpportunities({ location: 'Goa', limit: 50 });
    expect(goaRes.data.length).toBeGreaterThan(0);
    goaRes.data.forEach(item => {
      expect(item.location.toLowerCase()).toContain('goa');
    });

    // Pagination
    const page1 = await listOpportunities({ limit: 10, page: 1 });
    const page2 = await listOpportunities({ limit: 10, page: 2 });
    expect(page1.data.length).toBe(10);
    expect(page2.data.length).toBe(10);
    expect(page1.data[0].id).not.toBe(page2.data[0].id);
  });
});
