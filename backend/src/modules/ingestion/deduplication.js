import crypto from 'node:crypto';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'ref',
  'source',
  'fbclid',
  'gclid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
  'timestamp',
  'cache_bust',
  '_t',
  't',
  'session',
  'trk'
]);

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

export function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes an external job URL safely:
 * - Lowercases protocol and hostname
 * - Strips hash fragment
 * - Strips common tracking/attribution parameters
 * - Strips trailing slashes (except root)
 * - Sorts query parameters deterministically
 */
export function canonicalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = '';

    // Strip tracking parameters
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower) || lower.startsWith('utm_')) {
        parsed.searchParams.delete(key);
      }
    }

    // Strip trailing slashes from pathname (preserving root '/')
    let pathname = parsed.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '/';
    parsed.pathname = pathname.toLowerCase();

    // Sort search parameters for deterministic URL string
    parsed.searchParams.sort();

    return parsed.toString();
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Extracts a stable external job ID from data fields or known provider URL patterns.
 */
export function extractExternalJobId(data = {}) {
  const adNum = cleanText(data.advertisement_number);
  if (adNum) return adNum;

  const extId = cleanText(data.external_id || data.job_id || data.posting_id);
  if (extId) return extId;

  const rawUrl = data.source_url || data.source_document_url;
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$/, '');

    // Lever: https://jobs.lever.co/company/<jobId>
    if (host.includes('jobs.lever.co') || host.includes('jobs.eu.lever.co')) {
      const match = pathname.match(/^\/[^/]+\/([0-9a-f-]{36}|[^/?#]+)$/i);
      if (match && !match[1].startsWith('test-job-')) return match[1];
    }

    // Greenhouse: https://boards.greenhouse.io/company/jobs/<jobId>
    if (host.includes('greenhouse.io')) {
      const match = pathname.match(/\/jobs\/(\d+)/i) || url.searchParams.get('gh_jid');
      if (match) return typeof match === 'string' ? match : match[1];
    }

    // Ashby: https://jobs.ashbyhq.com/company/<jobId>
    if (host.includes('ashbyhq.com')) {
      const match = pathname.match(/^\/[^/]+\/([0-9a-f-]{36}|[^/?#]+)$/i);
      if (match) return match[1];
    }

    // SmartRecruiters: https://careers.smartrecruiters.com/company/<jobId>
    if (host.includes('smartrecruiters.com')) {
      const match = pathname.match(/^\/[^/]+\/([^/?#]+)$/i);
      if (match) return match[1];
    }

    // CBES Goa: https://cbes.goa.gov.in/advertisement?id=<hash>
    if (host.includes('cbes.goa.gov.in') && url.searchParams.has('id')) {
      const cbesId = url.searchParams.get('id');
      if (cbesId) return cbesId;
    }
  } catch {
    // Malformed URL, fallback gracefully
  }

  return null;
}

/**
 * Computes a deterministic, source-aware deduplication key for an opportunity.
 *
 * Identity Hierarchy:
 * 1. Stable External ID (advertisement number or provider job id) + Normalized Organization:
 *    Key: 'ad:' + sha256(normOrg + '::' + stableId).slice(0, 32)
 *
 * 2. Fallback Fingerprint:
 *    When external ID is missing, key is based on:
 *    - Source ID
 *    - Normalized organization
 *    - Normalized title
 *    - Normalized location
 *    - Recruitment cycle (YYYY-MM from application_opening, when available)
 *    Key: 'fp:' + sha256(sourceId + '::' + normOrg + '::' + normTitle + '::' + normLoc + cycle).slice(0, 32)
 */
export function computeOpportunityDedupKey(data = {}, sourceId = null) {
  const normOrg = cleanText(data.organization).toLowerCase();
  const normTitle = cleanText(data.title).toLowerCase();
  const normLoc = cleanText(data.location).toLowerCase();
  const effectiveSourceId = cleanText(sourceId || data.source_id).toLowerCase();

  const externalId = extractExternalJobId(data);
  if (externalId) {
    const raw = `${normOrg}::${externalId.toLowerCase()}`;
    return 'ad:' + sha256(raw).slice(0, 32);
  }

  // Derive recruitment cycle from opening date when present
  let cycle = '';
  const rawOpening = data.application_opening;
  if (rawOpening) {
    const parsed = new Date(rawOpening);
    if (!isNaN(parsed.getTime())) {
      const yr = parsed.getUTCFullYear();
      const mo = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      cycle = `::cycle:${yr}-${mo}`;
    }
  }

  const raw = `${effectiveSourceId || 'no-src'}::${normOrg}::${normTitle}::${normLoc}${cycle}`;
  return 'fp:' + sha256(raw).slice(0, 32);
}
