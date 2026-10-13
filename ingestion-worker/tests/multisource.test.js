import { describe, it, expect } from 'vitest';
import {
  extractOpportunity, extractLinks, looksLikeOpportunityDetail, stripHtml,
  hasJobPostingJsonLd, normalizeOpportunityType
} from '../src/extract.js';
import { detectJobBoardProvider, providerFeedUrl, parseProviderFeed } from '../src/providers.js';
import { parseRobotsTxt, RobotsPolicy } from '../src/robots.js';

describe('multi-source opportunity extraction', () => {
  it('classifies internship posts as internships on a private-careers source', () => {
    const html = '<title>Software Engineering Internship</title><meta name="author" content="Example Tech"><p>Role overview</p><p>Requirements: currently enrolled student</p><p>Apply now</p><p>Last date: 25/12/2026</p>';
    const result = extractOpportunity(html, 'https://example.com/careers/internship-software', { sourceType: 'private_careers', organization: 'Example Tech' });
    expect(result.opportunity_type).toBe('internship');
    expect(result.organization).toBe('Example Tech');
    expect(result.application_deadline).toBe('2026-12-25T23:59:59.000Z');
    expect(result.status).toBe('open');
  });

  it('normalizes Indian DD/MM/YYYY deadlines into ISO timestamps', () => {
    const result = extractOpportunity('<title>Recruitment</title><p>Apply before 15/12/2026</p>', 'https://example.gov.in/notice', { sourceType: 'government_recruitment' });
    expect(result.application_deadline).toBe('2026-12-15T23:59:59.000Z');
  });

  it('extracts JobPosting JSON-LD as a structured job record', () => {
    const html = `<html><head><title>Backend Engineer</title><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Backend Engineer', datePosted: '2026-10-01', validThrough: '2026-12-30',
      description: '<p>Build services</p>', hiringOrganization: { '@type': 'Organization', name: 'Example Labs' },
      jobLocation: { '@type': 'Place', address: { addressLocality: 'Panaji', addressRegion: 'Goa', addressCountry: 'India' } }, identifier: { value: 'ENG-100' }
    })}</script></head><body></body></html>`;
    expect(hasJobPostingJsonLd(html)).toBe(true);
    const result = extractOpportunity(html, 'https://example.com/jobs/backend', { sourceType: 'private_careers' });
    expect(result.title).toBe('Backend Engineer');
    expect(result.organization).toBe('Example Labs');
    expect(result.location).toContain('Panaji');
    expect(result.advertisement_number).toBe('ENG-100');
    expect(result.application_deadline).toBe('2026-12-30T23:59:59.000Z');
  });

  it('classifies a scholarship source without falsely converting it into a private job', () => {
    expect(normalizeOpportunityType('scholarship_programme', 'Merit Scholarship', '', 'https://example.edu/scholarship')).toBe('scholarship');
  });

  it('discovers only same-host opportunity-like links', () => {
    const html = '<a href="/jobs/backend-engineer">Backend Engineer</a><a href="/internships/data">Data Internship</a><a href="https://other.example/jobs/x">External Job</a><a href="/privacy">Privacy</a><a href="mailto:jobs@example.com">Email jobs</a>';
    const links = extractLinks(html, 'https://example.com/careers');
    expect(links.map((link) => link.url)).toEqual([
      'https://example.com/jobs/backend-engineer',
      'https://example.com/internships/data'
    ]);
  });

  it('does not treat a generic careers listing page as one job', () => {
    const html = '<title>Careers at Example Tech</title><p>Join our team and explore jobs.</p><p>Apply now</p><p>Requirements and responsibilities are listed below for all roles.</p>';
    expect(looksLikeOpportunityDetail(html, 'https://example.com/careers')).toBe(false);
  });

  it('recognizes a public job detail page when it has role-specific signals', () => {
    const html = '<title>Backend Software Engineer</title><p>Role overview: build APIs.</p><p>Requirements: Node.js and SQL.</p><p>Apply now.</p>';
    expect(looksLikeOpportunityDetail(html, 'https://example.com/jobs/backend-software-engineer')).toBe(true);
  });

  it('strips encoded markup from public provider descriptions', () => {
    expect(stripHtml('&lt;p&gt;Build great things &amp; ship&lt;/p&gt;')).toBe('Build great things & ship');
  });
});

describe('public ATS provider adapters', () => {
  it('detects and creates a Greenhouse public feed URL', () => {
    expect(detectJobBoardProvider('https://boards.greenhouse.io/exampleco')).toBe('greenhouse');
    expect(providerFeedUrl('https://boards.greenhouse.io/exampleco', 'greenhouse')).toBe('https://boards-api.greenhouse.io/v1/boards/exampleco/jobs?content=true');
  });

  it('detects and creates Lever public postings feed', () => {
    expect(detectJobBoardProvider('https://jobs.lever.co/exampleco')).toBe('lever');
    expect(providerFeedUrl('https://jobs.lever.co/exampleco', 'lever')).toBe('https://api.lever.co/v0/postings/exampleco?mode=json');
  });

  it('detects and creates Ashby public posting feed', () => {
    expect(detectJobBoardProvider('https://jobs.ashbyhq.com/exampleco')).toBe('ashby');
    expect(providerFeedUrl('https://jobs.ashbyhq.com/exampleco', 'ashby')).toBe('https://api.ashbyhq.com/posting-api/job-board/exampleco?includeCompensation=true');
  });

  it('maps Lever internship items into the backend candidate shape', () => {
    const results = parseProviderFeed([{ id: 'abc123', text: 'Product Design Intern', hostedUrl: 'https://jobs.lever.co/example/abc123', descriptionPlain: 'Join the design internship.', categories: { location: 'Remote', commitment: 'Internship' }, createdAt: 1790800000000 }], 'lever', { source_type: 'private_careers', organization: 'Example Corp' }, 'https://api.lever.co/v0/postings/example?mode=json');
    expect(results).toHaveLength(1);
    expect(results[0].candidate.title).toBe('Product Design Intern');
    expect(results[0].candidate.organization).toBe('Example Corp');
    expect(results[0].candidate.opportunity_type).toBe('internship');
    expect(results[0].candidate.source_url).toBe('https://jobs.lever.co/example/abc123');
  });
});

describe('robots policy', () => {
  it('parses disallow and allow rules and prefers the most specific rule', () => {
    const policy = parseRobotsTxt('User-agent: *\nDisallow: /private\nAllow: /private/jobs\nCrawl-delay: 2');
    expect(policy.length).toBeGreaterThan(0);
    expect(policy[0].rules).toEqual([{ type: 'disallow', path: '/private' }, { type: 'allow', path: '/private/jobs' }]);
    expect(policy[0].crawlDelay).toBe(2);
  });

  it('blocks a URL disallowed by robots.txt', async () => {
    const instance = new RobotsPolicy(async () => ({ ok: true, status: 200, text: 'User-agent: *\nDisallow: /blocked' }));
    expect((await instance.check('https://example.com/blocked/job')).allowed).toBe(false);
    expect((await instance.check('https://example.com/jobs')).allowed).toBe(true);
  });
});
