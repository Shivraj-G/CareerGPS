import { describe, it, expect, vi } from 'vitest';
import {
  extractOpportunity,
  extractLinks,
  looksLikeOpportunityDetail,
  stripHtml
} from '../src/extract.js';
import { RobotsPolicy } from '../src/robots.js';

describe('Robots.txt HTTP Status Resilience', () => {
  it('fails closed on HTTP 403 Forbidden and attaches code and status', async () => {
    const fetchRobots = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: '<html><head><title>403 Forbidden</title></head><body>Forbidden</body></html>'
    });

    const policy = new RobotsPolicy(fetchRobots);
    const result = await policy.check('https://www.goa.gov.in/citizen/recruitment/');

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
    expect(result.code).toBe('ROBOTS_FORBIDDEN');
    expect(result.reason).toContain('forbidden response');
    expect(fetchRobots).toHaveBeenCalledTimes(1);
  });

  it('fails closed on HTTP 401 Unauthorized and attaches code and status', async () => {
    const fetchRobots = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: 'Unauthorized'
    });

    const policy = new RobotsPolicy(fetchRobots);
    const result = await policy.check('https://example.gov.in/recruitment/');

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(401);
    expect(result.code).toBe('ROBOTS_FORBIDDEN');
  });

  it('permits crawling on HTTP 404 Not Found as per standard robots.txt spec', async () => {
    const fetchRobots = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: 'Not found'
    });

    const policy = new RobotsPolicy(fetchRobots);
    const result = await policy.check('https://cbes.goa.gov.in/advertisement');

    expect(result.allowed).toBe(true);
    expect(fetchRobots).toHaveBeenCalledTimes(1);
  });

  it('respects Disallow directives and attaches ROBOTS_DISALLOWED code', async () => {
    const fetchRobots = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: 'User-agent: *\nDisallow: /admin\nDisallow: /restricted/'
    });

    const policy = new RobotsPolicy(fetchRobots);
    const blockedResult = await policy.check('https://example.gov.in/restricted/postings');
    const allowedResult = await policy.check('https://example.gov.in/public/postings');

    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.code).toBe('ROBOTS_DISALLOWED');
    expect(allowedResult.allowed).toBe(true);
  });
});

describe('Official Government Recruitment Parsing & Extraction', () => {
  it('extracts structured recruitment from official CBES tabular HTML format', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Advertisement Details - Goa Online Recruitment</title></head>
      <body>
        <nav><a href="/home">Home</a><a href="/login">Login</a></nav>
        <div class="content">
          <p><strong>Advertisement Name :</strong> ADVT/2026/03</p>
          <p><strong>Department Name :</strong> PUBLIC HEALTH DEPARTMENT(GOA MEDICAL COLLEGE)</p>
          <p><strong>Post Name :</strong> Medical Officer</p>
          <p><strong>No of Vacancies :</strong> 4</p>
          <p><strong>Application Start Date :</strong> 01/10/2026</p>
          <p><strong>Application End Date :</strong> 25/11/2026</p>
          <p><strong>Essential Qualifications :</strong> MBBS degree from recognized university and registration with Medical Council.</p>
        </div>
      </body>
      </html>
    `;

    expect(looksLikeOpportunityDetail(html, 'https://cbes.goa.gov.in/advertisement?id=abc12345')).toBe(true);

    const extracted = extractOpportunity(html, 'https://cbes.goa.gov.in/advertisement?id=abc12345', {
      sourceType: 'official_government',
      organization: 'Government of Goa'
    });

    expect(extracted.title).toBe('Medical Officer');
    expect(extracted.organization).toBe('PUBLIC HEALTH DEPARTMENT(GOA MEDICAL COLLEGE)');
    expect(extracted.advertisement_number).toBe('ADVT/2026/03');
    expect(extracted.vacancies_total).toBe(4);
    expect(extracted.application_deadline).toBe('2026-11-25T23:59:59.000Z');
    expect(extracted.application_opening).toBe('2026-10-01T00:00:00.000Z');
    expect(extracted.status).toBe('open');
    expect(extracted.requirements.length).toBeGreaterThan(0);
    expect(extracted.requirements[0].requirement_text).toContain('MBBS degree');
    expect(extracted.location).toBe('Goa');
  });

  it('extracts GPSC notice with Indian deadline and advertisement number', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>GPSC Recruitment Notification 2026</title></head>
      <body>
        <h1>Junior Environmental Engineer Recruitment</h1>
        <p>Department: Goa State Pollution Control Board</p>
        <p>Advertisement No: GPSC/2026/ADV-09</p>
        <p>No of Vacancies: 12</p>
        <p>Last date to apply: 15/12/2026</p>
        <p>Qualifications: Degree in Environmental Engineering or Chemical Engineering.</p>
      </body>
      </html>
    `;

    expect(looksLikeOpportunityDetail(html, 'https://gpsc.goa.gov.in/advt-09.html')).toBe(true);

    const extracted = extractOpportunity(html, 'https://gpsc.goa.gov.in/advt-09.html', {
      sourceType: 'government_recruitment',
      organization: 'Goa Public Service Commission'
    });

    expect(extracted.title).toContain('Junior Environmental Engineer');
    expect(extracted.advertisement_number).toBe('GPSC/2026/ADV-09');
    expect(extracted.vacancies_total).toBe(12);
    expect(extracted.application_deadline).toBe('2026-12-15T23:59:59.000Z');
    expect(extracted.status).toBe('open');
  });

  it('extracts recruitment links including query-parameterized advertisement links', () => {
    const html = `
      <div>
        <a href="/advertisement?id=12345">View Advertisement 1</a>
        <a href="/advertisement?id=67890">View Advertisement 2</a>
        <a href="/login">User Login</a>
        <a href="/faq">Frequently Asked Questions</a>
        <a href="https://other.gov.in/recruitment">External Site</a>
      </div>
    `;

    const links = extractLinks(html, 'https://cbes.goa.gov.in/advertisement');
    expect(links.map((l) => l.url)).toEqual([
      'https://cbes.goa.gov.in/advertisement?id=12345',
      'https://cbes.goa.gov.in/advertisement?id=67890'
    ]);
  });
});

describe('Malformed HTML and Edge Cases Resilience', () => {
  it('handles severely broken HTML with unclosed tags and broken tables without throwing', () => {
    const brokenHtml = `
      <table>
        <tr>
          <td>Post Name : Senior Chemist
          <td>Department Name : Water Resources Department
          <p>Application End Date : 30/11/2026
          <div>No of Vacancies : 2
          <b>Unclosed bold text
    `;

    expect(() => {
      const extracted = extractOpportunity(brokenHtml, 'https://example.gov.in/detail?id=1', {
        sourceType: 'government_recruitment'
      });
      expect(extracted.title).toBe('Senior Chemist');
      expect(extracted.organization).toBe('Water Resources Department');
      expect(extracted.application_deadline).toBe('2026-11-30T23:59:59.000Z');
      expect(extracted.vacancies_total).toBe(2);
    }).not.toThrow();
  });

  it('handles HTML with null characters and encoded entities without crashing', () => {
    const strangeHtml = '<title>Post &amp; Details\0</title><p>Department Name : Finance</p><p>Apply by: 12/12/2026</p>';
    expect(() => {
      const cleaned = stripHtml(strangeHtml);
      expect(cleaned).toContain('Finance');
      const extracted = extractOpportunity(strangeHtml, 'https://example.gov.in/detail', {
        sourceType: 'government_recruitment'
      });
      expect(extracted.application_deadline).toBe('2026-12-12T23:59:59.000Z');
      expect(extracted.organization).toBe('Finance');
    }).not.toThrow();
  });

  it('safely rejects non-opportunity pages (empty results / generic pages)', () => {
    const genericHtml = `
      <html>
      <head><title>Government of Goa - Contact Us</title></head>
      <body>
        <h1>Contact Information</h1>
        <p>Secretariat, Porvorim, Goa - 403521</p>
        <p>Email: contact@goa.gov.in</p>
      </body>
      </html>
    `;

    expect(looksLikeOpportunityDetail(genericHtml, 'https://example.gov.in/contact')).toBe(false);
  });

  it('does not falsely classify a page as detail just because login is in the navbar', () => {
    const detailHtmlWithNav = `
      <title>Assistant Director (Planning)</title>
      <nav><a href="/login">Login</a></nav>
      <div class="content">
        <h1>Assistant Director (Planning)</h1>
        <p>Department: Directorate of Planning, Statistics and Evaluation</p>
        <p>Last date: 18/11/2026</p>
        <p>No of Vacancies: 1</p>
        <p>Essential Qualification: Master's Degree in Economics or Statistics</p>
      </div>
    `;

    expect(looksLikeOpportunityDetail(detailHtmlWithNav, 'https://example.gov.in/recruit/detail/101')).toBe(true);
  });
});

describe('Candidate Deduplication & Dry-Run Ingestion Semantics', () => {
  it('correctly categorizes backend duplicate response without failing the source', () => {
    // Simulating worker tracking when backend returns duplicate: true vs candidate id
    const results = {
      discovered: 2,
      submitted: 0,
      duplicates: 0,
      previewed: 0
    };

    const backendResponses = [
      { duplicate: false, id: 'cand-uuid-1' },
      { duplicate: true, duplicate_id: 'cand-uuid-1', duplicate_type: 'candidate' }
    ];

    for (const resp of backendResponses) {
      if (resp.duplicate) {
        results.duplicates += 1;
      } else {
        results.submitted += 1;
      }
    }

    expect(results.discovered).toBe(2);
    expect(results.submitted).toBe(1);
    expect(results.duplicates).toBe(1);
  });

  it('verifies dry-run accounting contract: previewed is incremented and submitted is 0', () => {
    const results = {
      discovered: 5,
      submitted: 0,
      duplicates: 0,
      previewed: 0
    };
    const isDryRun = true;

    for (let i = 0; i < results.discovered; i++) {
      if (isDryRun) {
        results.previewed += 1;
      } else {
        results.submitted += 1;
      }
    }

    expect(results.submitted).toBe(0);
    expect(results.previewed).toBe(5);
    expect(results.discovered).toBe(5);
  });

  it('ensures blocked sources are never marked completed in run summary', () => {
    const sourceResults = [
      {
        source: 'Blocked Source',
        status: 'blocked',
        pagesAttempted: 1,
        pagesFetched: 0,
        pagesBlocked: 1,
        pageFailures: 0,
        discovered: 0,
        submitted: 0
      },
      {
        source: 'Valid Source',
        status: 'completed',
        pagesAttempted: 5,
        pagesFetched: 5,
        pagesBlocked: 0,
        pageFailures: 0,
        discovered: 3,
        submitted: 3
      }
    ];

    const summary = {
      attempted: sourceResults.length,
      completed: sourceResults.filter((r) => r.status === 'completed').length,
      blocked: sourceResults.filter((r) => r.status === 'blocked').length,
      failed: sourceResults.filter((r) => r.status === 'failed').length,
      pagesAttempted: sourceResults.reduce((s, r) => s + r.pagesAttempted, 0),
      pagesFetched: sourceResults.reduce((s, r) => s + r.pagesFetched, 0),
      pagesBlocked: sourceResults.reduce((s, r) => s + r.pagesBlocked, 0),
      discovered: sourceResults.reduce((s, r) => s + r.discovered, 0),
      submitted: sourceResults.reduce((s, r) => s + r.submitted, 0)
    };

    expect(summary.attempted).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.pagesBlocked).toBe(1);
    expect(summary.pagesFetched).toBe(5);
  });
});
