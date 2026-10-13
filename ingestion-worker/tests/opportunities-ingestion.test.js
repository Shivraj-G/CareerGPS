import { describe, expect, it } from 'vitest';
import { normalizeOpportunityType } from '../src/extract.js';
import { parseProviderFeed, detectJobBoardProvider, providerFeedUrl } from '../src/providers.js';

describe('Opportunities Ingestion Pipeline', () => {
  it('correctly maps opportunity categories from source and titles', () => {
    expect(normalizeOpportunityType('official_government', 'Junior Assistant Post', '', 'https://example.gov.in')).toBe('government_recruitment');
    expect(normalizeOpportunityType('private_careers', 'Frontend Software Engineer', '', 'https://jobs.lever.co/company/1')).toBe('private_job');
    expect(normalizeOpportunityType('private_careers', 'AI Research Intern', '3 months summer internship', 'https://jobs.lever.co/company/2')).toBe('internship');
    expect(normalizeOpportunityType('private_careers', 'Trade Apprentice 2026', 'National Apprenticeship program', 'https://example.com/apprentice')).toBe('apprenticeship');
    expect(normalizeOpportunityType('education', 'Postgraduate Merit Fellowship', 'Scholarship grant', 'https://example.org/fellowship')).toBe('scholarship');
  });

  it('detects Lever public job board feeds accurately', () => {
    const provider = detectJobBoardProvider('https://jobs.lever.co/Sprinto');
    expect(provider).toBe('lever');

    const feedUrl = providerFeedUrl('https://jobs.lever.co/Sprinto', 'lever');
    expect(feedUrl).toBe('https://api.lever.co/v0/postings/Sprinto?mode=json');
  });

  it('extracts private jobs and internships from Lever feed payload', () => {
    const samplePayload = [
      {
        id: 'job-1',
        text: 'Senior Full Stack Engineer',
        createdAt: 1710000000000,
        hostedUrl: 'https://jobs.lever.co/Sprinto/job-1',
        descriptionPlain: 'Build scalable web applications with React and Node.js',
        categories: {
          location: 'Bengaluru',
          commitment: 'Full time',
          team: 'Engineering'
        }
      },
      {
        id: 'intern-1',
        text: 'Product Design Intern',
        createdAt: 1710000000000,
        hostedUrl: 'https://jobs.lever.co/Sprinto/intern-1',
        descriptionPlain: 'Work alongside senior designers on UX research and UI flows',
        categories: {
          location: 'Remote (India)',
          commitment: 'Internship',
          team: 'Design'
        }
      }
    ];

    const source = {
      name: 'Sprinto public careers board',
      source_type: 'private_careers',
      organization: 'Sprinto'
    };

    const items = parseProviderFeed(samplePayload, 'lever', source, 'https://api.lever.co/v0/postings/Sprinto?mode=json');
    expect(items.length).toBe(2);

    const job = items[0].candidate;
    expect(job.title).toBe('Senior Full Stack Engineer');
    expect(job.organization).toBe('Sprinto');
    expect(job.opportunity_type).toBe('private_job');
    expect(job.location).toBe('Bengaluru');
    expect(job.status).toBe('open');

    const intern = items[1].candidate;
    expect(intern.title).toBe('Product Design Intern');
    expect(intern.organization).toBe('Sprinto');
    expect(intern.opportunity_type).toBe('internship');
    expect(intern.location).toBe('Remote (India)');
    expect(intern.status).toBe('open');
  });

  it('handles missing optional fields without throwing errors', () => {
    const payloadWithMissingFields = [
      {
        id: 'minimal-1',
        text: 'Minimal Job Notice',
        hostedUrl: 'https://jobs.lever.co/Sprinto/minimal-1'
        // description, categories, location, commitment, createdAt are all missing
      }
    ];

    const source = {
      name: 'Sprinto public careers board',
      source_type: 'private_careers',
      organization: 'Sprinto'
    };

    const items = parseProviderFeed(payloadWithMissingFields, 'lever', source, 'https://api.lever.co/v0/postings/Sprinto?mode=json');
    expect(items.length).toBe(1);

    const parsed = items[0].candidate;
    expect(parsed.title).toBe('Minimal Job Notice');
    expect(parsed.organization).toBe('Sprinto');
    expect(parsed.location).toBeNull();
    expect(parsed.description).toBeNull();
    expect(parsed.application_deadline).toBeNull();
    expect(parsed.status).toBe('open');
  });

  it('canonicalizeUrl normalizes URLs and strips UTM tracking parameters', async () => {
    const { canonicalizeUrl } = await import('../src/extract.js');
    const dirty = 'https://jobs.lever.co/Sprinto/test-job/?utm_source=linkedin&ref=boards#apply';
    const clean = canonicalizeUrl(dirty);
    expect(clean).toBe('https://jobs.lever.co/sprinto/test-job');
  });
});
