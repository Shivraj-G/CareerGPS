import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isUuid, stripHtml, meta, titleFromHtml, extractOpportunity, extractLinks,
  looksLikeOpportunityDetail, hasJobPostingJsonLd, normalizeOpportunityType
} from '../src/extract.js';
import { detectJobBoardProvider, providerFeedUrl, parseProviderFeed } from '../src/providers.js';
import { parseRobotsTxt, RobotsPolicy } from '../src/robots.js';

test('UUID helper accepts UUIDs and rejects placeholders', () => {
  assert.equal(isUuid('11111111-1111-4111-8111-111111111111'), true);
  assert.equal(isUuid('replace-with-run-uuid'), false);
  assert.equal(isUuid(123), false);
});

test('HTML cleanup drops active content and decodes common entities', () => {
  assert.equal(stripHtml('<p>Keep me</p><script>alert("x")</script><style>.x{}</style>'), 'Keep me');
  assert.equal(stripHtml('<p>Terms &amp; Conditions</p>'), 'Terms & Conditions');
  assert.equal(stripHtml('&lt;p&gt;Build great things &amp; ship&lt;/p&gt;'), 'Build great things & ship');
});

test('meta and title extraction support common public source pages', () => {
  assert.equal(meta('<meta property="og:title" content="Recruitment Notice 2026" />', 'og:title'), 'Recruitment Notice 2026');
  assert.equal(meta('<meta name="author" content="Goa Public Service Commission" />', 'author'), 'Goa Public Service Commission');
  assert.equal(titleFromHtml('<title>  Some   Notice  </title>'), 'Some Notice');
  assert.equal(titleFromHtml('<body>none</body>'), null);
});

test('government notice extractor converts Indian deadline to ISO', () => {
  const html = '<title>Recruitment Notice</title><meta name="author" content="Goa Public Service Commission"><p>Advertisement No: GPSC/2026/045</p><p>Last Date: 15/12/2026</p>';
  const result = extractOpportunity(html, 'https://example.gov.in/recruitment/notice', { sourceType: 'government_recruitment' });
  assert.equal(result.organization, 'Goa Public Service Commission');
  assert.equal(result.advertisement_number, 'GPSC/2026/045');
  assert.equal(result.application_deadline, '2026-12-15T23:59:59.000Z');
  assert.equal(result.opportunity_type, 'government_recruitment');
});

test('internship listing is correctly categorized even when source is a mixed private career board', () => {
  const html = '<title>Software Engineering Internship</title><meta name="author" content="Example Tech"><p>Role overview</p><p>Requirements: currently enrolled student</p><p>Apply now</p><p>Last date: 25/12/2026</p>';
  const result = extractOpportunity(html, 'https://example.com/careers/internship-software', { sourceType: 'private_careers', organization: 'Example Tech' });
  assert.equal(result.opportunity_type, 'internship');
  assert.equal(result.organization, 'Example Tech');
  assert.equal(result.application_deadline, '2026-12-25T23:59:59.000Z');
});

test('schema.org JobPosting data is preferred for job identity, employer, location and deadline', () => {
  const posting = {
    '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Backend Engineer', datePosted: '2026-10-01', validThrough: '2026-12-30',
    description: '<p>Build services</p>', hiringOrganization: { '@type': 'Organization', name: 'Example Labs' },
    jobLocation: { '@type': 'Place', address: { addressLocality: 'Panaji', addressRegion: 'Goa', addressCountry: 'India' } },
    identifier: { value: 'ENG-100' }
  };
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(posting)}</script></head><body></body></html>`;
  assert.equal(hasJobPostingJsonLd(html), true);
  const result = extractOpportunity(html, 'https://example.com/jobs/backend', { sourceType: 'private_careers' });
  assert.equal(result.title, 'Backend Engineer');
  assert.equal(result.organization, 'Example Labs');
  assert.match(result.location, /Panaji/);
  assert.equal(result.advertisement_number, 'ENG-100');
  assert.equal(result.application_deadline, '2026-12-30T23:59:59.000Z');
});

test('private career source types classify as private jobs when no internship signal exists', () => {
  assert.equal(normalizeOpportunityType('private_careers', 'Backend Engineer', 'Build APIs', 'https://example.com/jobs/engineer'), 'private_job');
  assert.equal(normalizeOpportunityType('internship_board', 'Product Designer', '', 'https://example.com/jobs/1'), 'internship');
  assert.equal(normalizeOpportunityType('scholarship_programme', 'Merit Scholarship', '', 'https://example.edu/scholarship'), 'scholarship');
});

test('link discovery stays on approved hosts and ignores unneeded paths', () => {
  const html = '<a href="/jobs/backend-engineer">Backend Engineer</a><a href="/internships/data">Data Internship</a><a href="https://other.example/jobs/x">External Job</a><a href="/privacy">Privacy</a><a href="mailto:jobs@example.com">Email jobs</a>';
  assert.deepEqual(extractLinks(html, 'https://example.com/careers').map((link) => link.url), [
    'https://example.com/jobs/backend-engineer', 'https://example.com/internships/data'
  ]);
});

test('generic career landing pages are not misclassified as a single job', () => {
  const html = '<title>Careers at Example Tech</title><p>Join our team and explore jobs.</p><p>Apply now</p><p>Requirements and responsibilities are listed below for all roles.</p>';
  assert.equal(looksLikeOpportunityDetail(html, 'https://example.com/careers'), false);
});

test('specific role pages are detected when multiple role signals exist', () => {
  const html = '<title>Backend Software Engineer</title><p>Role overview: build APIs.</p><p>Requirements: Node.js and SQL.</p><p>Apply now.</p>';
  assert.equal(looksLikeOpportunityDetail(html, 'https://example.com/jobs/backend-software-engineer'), true);
});

test('Greenhouse public job-board adapter derives its documented public feed', () => {
  assert.equal(detectJobBoardProvider('https://boards.greenhouse.io/exampleco'), 'greenhouse');
  assert.equal(providerFeedUrl('https://boards.greenhouse.io/exampleco', 'greenhouse'), 'https://boards-api.greenhouse.io/v1/boards/exampleco/jobs?content=true');
});

test('Lever and Ashby public job-board adapters derive their feed URLs', () => {
  assert.equal(detectJobBoardProvider('https://jobs.lever.co/exampleco'), 'lever');
  assert.equal(providerFeedUrl('https://jobs.lever.co/exampleco', 'lever'), 'https://api.lever.co/v0/postings/exampleco?mode=json');
  assert.equal(detectJobBoardProvider('https://jobs.ashbyhq.com/exampleco'), 'ashby');
  assert.equal(providerFeedUrl('https://jobs.ashbyhq.com/exampleco', 'ashby'), 'https://api.ashbyhq.com/posting-api/job-board/exampleco?includeCompensation=true');
});

test('Lever feed records become backend-shaped internship candidates', () => {
  const records = parseProviderFeed([{
    id: 'abc123', text: 'Product Design Intern', hostedUrl: 'https://jobs.lever.co/example/abc123',
    descriptionPlain: 'Join the design internship.', categories: { location: 'Remote', commitment: 'Internship' }, createdAt: 1790800000000
  }], 'lever', { source_type: 'private_careers', organization: 'Example Corp' }, 'https://api.lever.co/v0/postings/example?mode=json');
  assert.equal(records.length, 1);
  assert.equal(records[0].candidate.title, 'Product Design Intern');
  assert.equal(records[0].candidate.organization, 'Example Corp');
  assert.equal(records[0].candidate.opportunity_type, 'internship');
  assert.equal(records[0].candidate.source_url, 'https://jobs.lever.co/example/abc123');
});

test('robots.txt parser keeps crawl delay in seconds and supports allow/disallow', () => {
  const parsed = parseRobotsTxt('User-agent: *\nDisallow: /private\nAllow: /private/jobs\nCrawl-delay: 2');
  assert.equal(parsed[0].crawlDelay, 2);
  assert.deepEqual(parsed[0].rules, [{ type: 'disallow', path: '/private' }, { type: 'allow', path: '/private/jobs' }]);
});

test('robots policy blocks disallowed URLs and permits matching public paths', async () => {
  const policy = new RobotsPolicy(async () => ({ ok: true, status: 200, text: 'User-agent: *\nDisallow: /blocked' }));
  assert.equal((await policy.check('https://example.com/blocked/job')).allowed, false);
  assert.equal((await policy.check('https://example.com/jobs')).allowed, true);
});
