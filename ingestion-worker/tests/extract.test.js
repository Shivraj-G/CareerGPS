import { describe, it, expect } from 'vitest';
import { isUuid, stripHtml, meta, titleFromHtml, extractOpportunity } from '../src/extract.js';

describe('isUuid', () => {
  it('accepts a valid v4 UUID', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
  });

  it('rejects the .env placeholder text', () => {
    expect(isUuid('replace-with-run-uuid')).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(12345)).toBe(false);
  });

  it('rejects a malformed UUID (wrong segment lengths)', () => {
    expect(isUuid('11111111-1111-4111-8111-11111111111')).toBe(false); // one char short
  });
});

describe('stripHtml', () => {
  it('removes script and style blocks entirely, not just their tags', () => {
    const html = '<p>Keep me</p><script>alert("drop me")</script><style>.a{color:red}</style>';
    const text = stripHtml(html);
    expect(text).toContain('Keep me');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color:red');
  });

  it('decodes common HTML entities', () => {
    expect(stripHtml('<p>Terms &amp; Conditions</p>')).toBe('Terms & Conditions');
    expect(stripHtml('<p>It&#39;s open</p>')).toBe("It's open");
  });

  it('collapses repeated whitespace', () => {
    expect(stripHtml('<p>a</p>\n\n<p>b</p>   <p>c</p>')).toBe('a b c');
  });
});

describe('meta', () => {
  it('extracts a meta tag by property (og:title)', () => {
    const html = '<meta property="og:title" content="Recruitment Notice 2026" />';
    expect(meta(html, 'og:title')).toBe('Recruitment Notice 2026');
  });

  it('extracts a meta tag by name (author)', () => {
    const html = '<meta name="author" content="Goa Public Service Commission" />';
    expect(meta(html, 'author')).toBe('Goa Public Service Commission');
  });

  it('returns null when the tag is absent', () => {
    expect(meta('<html><head></head></html>', 'og:title')).toBeNull();
  });
});

describe('titleFromHtml', () => {
  it('extracts and trims the <title> contents', () => {
    expect(titleFromHtml('<title>  Some   Notice  </title>')).toBe('Some Notice');
  });

  it('returns null when there is no title tag', () => {
    expect(titleFromHtml('<html><body>no title here</body></html>')).toBeNull();
  });
});

describe('extractOpportunity', () => {
  const sampleHtml = `<!DOCTYPE html>
<html>
<head>
<title>Recruitment Notice - Goa Public Service Commission</title>
<meta property="og:title" content="Recruitment Notice 2026" />
<meta name="author" content="Goa Public Service Commission" />
</head>
<body>
<script>var x = 1;</script>
<style>.a{color:red}</style>
<p>This recruitment drive is for various posts across Goa.</p>
<p>Advertisement No: GPSC/2026/045</p>
<p>Last Date: 15/12/2026</p>
</body>
</html>`;

  it('extracts title, organization, location, advertisement number and deadline from a realistic notice', () => {
    const result = extractOpportunity(sampleHtml, 'https://example.com/notice');
    expect(result.title).toBe('Recruitment Notice 2026'); // og:title wins over <title>
    expect(result.organization).toBe('Goa Public Service Commission');
    expect(result.location).toBe('Goa');
    expect(result.advertisement_number).toBe('GPSC/2026/045');
    expect(result.application_deadline).toBe('15/12/2026');
  });

  it('does not include extraction_status — that belongs at the candidate envelope level, not in candidate_data', () => {
    const result = extractOpportunity(sampleHtml, 'https://example.com/notice');
    expect(result).not.toHaveProperty('extraction_status');
  });

  it('always carries source_url and source_document_url through unchanged', () => {
    const result = extractOpportunity(sampleHtml, 'https://example.com/notice');
    expect(result.source_url).toBe('https://example.com/notice');
    expect(result.source_document_url).toBe('https://example.com/notice');
  });

  it('leaves fields null rather than guessing when the page has no matching evidence', () => {
    const emptyHtml = '<html><head><title>Untitled Page</title></head><body><p>Nothing relevant here.</p></body></html>';
    const result = extractOpportunity(emptyHtml, 'https://example.com/blank');
    expect(result.organization).toBeNull();
    expect(result.location).toBeNull();
    expect(result.advertisement_number).toBeNull();
    expect(result.application_deadline).toBeNull();
    expect(result.vacancies_total).toBeNull(); // never extracted — always null per current baseline
    expect(result.career_ids).toEqual([]); // never guessed
  });

  it('falls back to <title> when no og:title meta tag is present', () => {
    const html = '<title>Fallback Title Notice</title><p>no og tag here, mentions Goa</p>';
    const result = extractOpportunity(html, 'https://example.com/fallback');
    expect(result.title).toBe('Fallback Title Notice');
  });

  it('truncates description to 5000 characters', () => {
    const longHtml = `<p>${'a'.repeat(6000)}</p>`;
    const result = extractOpportunity(longHtml, 'https://example.com/long');
    expect(result.description.length).toBe(5000);
  });
});
