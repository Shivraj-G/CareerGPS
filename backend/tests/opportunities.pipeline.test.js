import { describe, expect, it } from 'vitest';
import { listOpportunities, getOpportunity } from '../src/modules/opportunities/opportunity.service.js';
import { submitCandidate, publishInternal, createRun } from '../src/modules/ingestion/ingestion.service.js';
import { pool } from '../src/config/database.js';

describe('Opportunities Data Pipeline End-to-End', () => {
  it('listOpportunities includes source_name, source_type, created_at, updated_at', async () => {
    const result = await listOpportunities({ page: 1, limit: 10 });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('pagination');
    expect(result.data.length).toBeGreaterThan(0);

    const first = result.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('organization');
    expect(first).toHaveProperty('opportunity_type');
    expect(first).toHaveProperty('status');
    expect(first).toHaveProperty('source_name');
    expect(first).toHaveProperty('source_type');
    expect(first).toHaveProperty('created_at');
    expect(first).toHaveProperty('updated_at');
  });

  it('filters by category: Government, Private job, and Internship', async () => {
    const govResult = await listOpportunities({ opportunity_type: 'Government', page: 1, limit: 10 });
    expect(govResult.data.length).toBeGreaterThan(0);
    govResult.data.forEach((item) => {
      expect(item.opportunity_type).toBe('government_recruitment');
    });

    const privateResult = await listOpportunities({ opportunity_type: 'Private Job', page: 1, limit: 10 });
    expect(privateResult.data.length).toBeGreaterThan(0);
    privateResult.data.forEach((item) => {
      expect(item.opportunity_type).toBe('private_job');
    });

    const internResult = await listOpportunities({ opportunity_type: 'Internship', page: 1, limit: 10 });
    expect(internResult.data.length).toBeGreaterThan(0);
    internResult.data.forEach((item) => {
      expect(item.opportunity_type).toBe('internship');
    });
  });

  it('supports search keyword across title, organization, and description', async () => {
    const searchResult = await listOpportunities({ search: 'Engineer', page: 1, limit: 10 });
    expect(searchResult.data.length).toBeGreaterThan(0);
    searchResult.data.forEach((item) => {
      const match =
        item.title.toLowerCase().includes('engineer') ||
        (item.organization && item.organization.toLowerCase().includes('engineer')) ||
        (item.description && item.description.toLowerCase().includes('engineer'));
      expect(match).toBe(true);
    });
  });

  it('getOpportunity returns complete record with requirements and source metadata', async () => {
    const list = await listOpportunities({ page: 1, limit: 5 });
    const sample = list.data[0];
    const detail = await getOpportunity(sample.id);

    expect(detail).not.toBeNull();
    expect(detail.id).toBe(sample.id);
    expect(detail.title).toBe(sample.title);
    expect(detail).toHaveProperty('source_name');
    expect(detail).toHaveProperty('source_type');
    expect(detail).toHaveProperty('requirements');
    expect(Array.isArray(detail.requirements)).toBe(true);
    expect(detail).toHaveProperty('related_careers');
    expect(Array.isArray(detail.related_careers)).toBe(true);
  });

  it('submitCandidate correctly handles duplicates vs improved records', async () => {
    // Look up Sprinto source
    const sourceRes = await pool.query(`SELECT id FROM sources WHERE name ILIKE '%Sprinto%' LIMIT 1`);
    expect(sourceRes.rowCount).toBeGreaterThan(0);
    const sourceId = sourceRes.rows[0].id;

    // Clean up any existing active run for this source in the test environment
    await pool.query(
      `UPDATE ingestion_runs SET status = 'completed' WHERE source_id = $1 AND status IN ('started', 'running')`,
      [sourceId]
    );

    // Create an active ingestion run
    const run = await createRun({ id: null }, sourceId);
    expect(run).toHaveProperty('id');

    const testUrl = `https://jobs.lever.co/Sprinto/test-job-${Date.now()}`;
    const initialPayload = {
      run_id: run.id,
      source_id: sourceId,
      document: {
        url: testUrl,
        document_title: 'Pipeline Verification QA Engineer',
        content_hash: 'initial_hash_123',
        raw_text: 'Initial job posting without deadline',
        extraction_version: 'test-v1'
      },
      candidate: {
        entity_type: 'opportunity',
        candidate_data: {
          title: 'Pipeline Verification QA Engineer',
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

    // 1. Initial submission should be inserted
    const firstSubmission = await submitCandidate(initialPayload);
    expect(firstSubmission).toHaveProperty('id');
    expect(firstSubmission.review_status).toBe('needs_review');

    // 2. Exact duplicate submission should return duplicate: true
    const duplicateSubmission = await submitCandidate(initialPayload);
    expect(duplicateSubmission).toHaveProperty('duplicate', true);

    // 3. Improved submission (with deadline, expanded description, vacancies) should return updated: true
    const improvedDeadline = new Date(Date.now() + 14 * 86400000).toISOString();
    const improvedPayload = {
      ...initialPayload,
      document: {
        ...initialPayload.document,
        content_hash: 'improved_hash_456',
        raw_text: 'Updated job posting with deadline and salary details'
      },
      candidate: {
        ...initialPayload.candidate,
        candidate_data: {
          ...initialPayload.candidate.candidate_data,
          application_deadline: improvedDeadline,
          vacancies_total: 3,
          description: 'Comprehensive updated description with required skills and criteria'
        }
      }
    };

    const updatedSubmission = await submitCandidate(improvedPayload);
    expect(updatedSubmission).toHaveProperty('updated', true);
    expect(updatedSubmission).toHaveProperty('candidate_id', firstSubmission.id);

    // Verify candidate in database has improved data
    const candidateInDb = await pool.query(`SELECT candidate_data FROM ingestion_candidates WHERE id = $1`, [firstSubmission.id]);
    expect(candidateInDb.rows[0].candidate_data.application_deadline).toBe(improvedDeadline);
    expect(candidateInDb.rows[0].candidate_data.vacancies_total).toBe(3);

    // 4. Publishing the approved candidate creates or updates the opportunity without 409 conflict
    const publishedOpp = await publishInternal(firstSubmission.id, { test: true });
    expect(publishedOpp).toHaveProperty('id');
    expect(publishedOpp.title).toBe('Pipeline Verification QA Engineer');

    // 5. Re-publishing the candidate updates the existing opportunity gracefully
    const republishOpp = await publishInternal(firstSubmission.id, { test_republish: true });
    expect(republishOpp).toHaveProperty('id', publishedOpp.id);

    // Cleanup test opportunity, candidate, and complete run
    await pool.query(`DELETE FROM opportunities WHERE id = $1`, [publishedOpp.id]);
    await pool.query(`DELETE FROM ingestion_candidates WHERE id = $1`, [firstSubmission.id]);
    await pool.query(`UPDATE ingestion_runs SET status = 'completed' WHERE id = $1`, [run.id]);
  });

  it('1. All + All returns all eligible opportunities without exclusions', async () => {
    const allResult = await listOpportunities({ status: 'all', opportunity_type: 'all', limit: 100 });
    expect(allResult.pagination.total).toBeGreaterThanOrEqual(60);
    expect(allResult.data.length).toBe(allResult.pagination.total);
    // Contains a mix of categories
    const categories = new Set(allResult.data.map(d => d.opportunity_type));
    expect(categories.has('government_recruitment')).toBe(true);
    expect(categories.has('private_job')).toBe(true);
    expect(categories.has('internship')).toBe(true);
  });

  it('2. Government shows only government opportunities without leaking private jobs or internships', async () => {
    const govResult = await listOpportunities({ opportunity_type: 'government', limit: 50 });
    expect(govResult.data.length).toBeGreaterThan(0);
    govResult.data.forEach(item => {
      expect(item.opportunity_type).toBe('government_recruitment');
      expect(item.opportunity_type).not.toBe('private_job');
      expect(item.opportunity_type).not.toBe('internship');
    });
  });

  it('3. Private Sector and Internship filters return only their respective categories', async () => {
    const privateResult = await listOpportunities({ opportunity_type: 'private_sector', limit: 50 });
    expect(privateResult.data.length).toBeGreaterThan(0);
    privateResult.data.forEach(item => {
      expect(item.opportunity_type).toBe('private_job');
      expect(item.opportunity_type).not.toBe('government_recruitment');
    });

    const internResult = await listOpportunities({ opportunity_type: 'internship', limit: 50 });
    expect(internResult.data.length).toBeGreaterThan(0);
    internResult.data.forEach(item => {
      expect(item.opportunity_type).toBe('internship');
      expect(item.opportunity_type).not.toBe('government_recruitment');
      expect(item.opportunity_type).not.toBe('private_job');
    });
  });

  it('4. Open, Closing Soon and Closed statuses are calculated consistently', async () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Open filter
    const openResult = await listOpportunities({ status: 'open', limit: 100 });
    expect(openResult.data.length).toBeGreaterThan(0);
    openResult.data.forEach(item => {
      if (item.application_deadline) {
        expect(new Date(item.application_deadline).getTime()).toBeGreaterThanOrEqual(now.getTime() - 10000);
      }
      expect(item.status).not.toBe('closed');
    });

    // Closing soon filter
    const closingSoonResult = await listOpportunities({ status: 'closing_soon', limit: 50 });
    expect(closingSoonResult.data.length).toBeGreaterThan(0);
    closingSoonResult.data.forEach(item => {
      expect(item.application_deadline).not.toBeNull();
      const deadline = new Date(item.application_deadline);
      expect(deadline.getTime()).toBeGreaterThanOrEqual(now.getTime() - 10000);
      expect(deadline.getTime()).toBeLessThanOrEqual(thirtyDaysFromNow.getTime() + 10000);
    });

    // Closed filter
    const closedResult = await listOpportunities({ status: 'closed', limit: 50 });
    expect(closedResult.data.length).toBeGreaterThan(0);
    closedResult.data.forEach(item => {
      const isPast = item.application_deadline && new Date(item.application_deadline).getTime() < now.getTime();
      const isStatusClosed = item.status === 'closed';
      expect(isPast || isStatusClosed).toBe(true);
    });
  });

  it('5. Search combined with category and status filters works together correctly', async () => {
    const combined = await listOpportunities({
      search: 'Sprinto',
      opportunity_type: 'private_sector',
      status: 'open',
      limit: 50
    });
    expect(combined.data.length).toBeGreaterThan(0);
    combined.data.forEach(item => {
      expect(item.opportunity_type).toBe('private_job');
      expect(item.organization.toLowerCase()).toContain('sprinto');
      if (item.application_deadline) {
        expect(new Date(item.application_deadline).getTime()).toBeGreaterThan(Date.now());
      }
    });
  });

  it('6. Empty results return cleanly without error and pagination matches 0', async () => {
    const emptyResult = await listOpportunities({ search: 'NonExistentZXYZSearch123456789' });
    expect(emptyResult.data).toEqual([]);
    expect(emptyResult.pagination.total).toBe(0);
    expect(emptyResult.pagination.total_pages).toBe(1);
    expect(emptyResult.pagination.page).toBe(1);
  });

  it('7. Pagination retains active filters across pages', async () => {
    const page1 = await listOpportunities({ opportunity_type: 'government', page: 1, limit: 5 });
    expect(page1.data.length).toBe(5);
    expect(page1.pagination.page).toBe(1);
    expect(page1.pagination.total).toBeGreaterThan(10);
    const totalCount = page1.pagination.total;

    const page2 = await listOpportunities({ opportunity_type: 'government', page: 2, limit: 5 });
    expect(page2.data.length).toBe(5);
    expect(page2.pagination.page).toBe(2);
    expect(page2.pagination.total).toBe(totalCount);
    expect(page2.data[0].id).not.toBe(page1.data[0].id);
    page2.data.forEach(item => {
      expect(item.opportunity_type).toBe('government_recruitment');
    });
  });

  it('8. Missing deadlines and optional fields do not throw or break serialization', async () => {
    const result = await listOpportunities({ limit: 100 });
    result.data.forEach(item => {
      expect(typeof item.title).toBe('string');
      expect(typeof item.organization).toBe('string');
      // Optional fields can be null, but must not crash serialization
      expect(item.vacancies_total === null || typeof item.vacancies_total === 'number').toBe(true);
      expect(item.application_deadline === null || typeof item.application_deadline === 'string' || item.application_deadline instanceof Date).toBe(true);
    });
  });

  it('9. Detail pages display structured and unstructured source data safely', async () => {
    const list = await listOpportunities({ limit: 5 });
    const detail = await getOpportunity(list.data[0].id);
    expect(detail).not.toBeNull();
    expect(detail).toHaveProperty('title');
    expect(detail).toHaveProperty('description');
    expect(detail).toHaveProperty('requirements');
    expect(detail).toHaveProperty('source_url');
    // Ensure HTML entities are decoded
    if (detail.description) {
      expect(detail.description).not.toContain('&amp;');
      expect(detail.description).not.toContain('&quot;');
    }
    detail.requirements.forEach(r => {
      expect(r.requirement_text).not.toContain('&amp;');
    });
  });
});
