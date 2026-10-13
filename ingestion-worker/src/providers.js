import { stripHtml, opportunityFromProviderItem } from './extract.js';

function safeSegment(value) {
  return String(value || '').split(/[/?#]/)[0].trim();
}

export function detectJobBoardProvider(baseUrl, explicitAdapter = '') {
  if (explicitAdapter && ['greenhouse', 'lever', 'ashby', 'smartrecruiters'].includes(explicitAdapter.toLowerCase())) return explicitAdapter.toLowerCase();
  let url;
  try { url = new URL(baseUrl); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (host === 'boards-api.greenhouse.io') return 'greenhouse';
  if (host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io') return 'greenhouse';
  if (host === 'jobs.lever.co' || host === 'jobs.eu.lever.co' || host === 'api.lever.co' || host === 'api.eu.lever.co') return 'lever';
  if (host === 'jobs.ashbyhq.com' || host === 'api.ashbyhq.com') return 'ashby';
  if (host === 'careers.smartrecruiters.com' || host === 'jobs.smartrecruiters.com' || host === 'api.smartrecruiters.com') return 'smartrecruiters';
  return null;
}

export function providerFeedUrl(baseUrl, provider) {
  const url = new URL(baseUrl);
  const host = url.hostname.toLowerCase();
  const firstSegment = safeSegment(url.pathname.split('/').filter(Boolean)[0]);
  if (provider === 'greenhouse') {
    if (host === 'boards-api.greenhouse.io') return url.toString().replace(/\/$/, '').includes('/jobs') ? url.toString() : `${url.toString().replace(/\/$/, '')}/jobs?content=true`;
    const token = host === 'job-boards.greenhouse.io' || host === 'boards.greenhouse.io' ? firstSegment : null;
    if (!token) throw new Error(`Cannot infer Greenhouse board token from ${baseUrl}. Use https://boards.greenhouse.io/<board-token>.`);
    return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
  }
  if (provider === 'lever') {
    if (host === 'api.lever.co' || host === 'api.eu.lever.co') return url.searchParams.has('mode') ? url.toString() : `${url.toString()}${url.search ? '&' : '?'}mode=json`;
    const company = firstSegment;
    if (!company) throw new Error(`Cannot infer Lever site name from ${baseUrl}. Use https://jobs.lever.co/<company>.`);
    const region = host === 'jobs.eu.lever.co' || url.searchParams.get('region') === 'eu' || /\/eu\//i.test(url.pathname) ? 'api.eu.lever.co' : 'api.lever.co';
    return `https://${region}/v0/postings/${encodeURIComponent(company)}?mode=json`;
  }
  if (provider === 'ashby') {
    if (host === 'api.ashbyhq.com') return url.toString();
    const board = firstSegment;
    if (!board) throw new Error(`Cannot infer Ashby board name from ${baseUrl}. Use https://jobs.ashbyhq.com/<board-name>.`);
    return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`;
  }
  if (provider === 'smartrecruiters') {
    if (host === 'api.smartrecruiters.com') return url.toString();
    const company = firstSegment;
    if (!company) throw new Error(`Cannot infer SmartRecruiters company from ${baseUrl}.`);
    return `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=100`;
  }
  throw new Error(`Unsupported public job-board adapter: ${provider}`);
}

export function parseProviderFeed(payload, provider, source, feedUrl) {
  let items;
  if (provider === 'greenhouse') items = Array.isArray(payload?.jobs) ? payload.jobs : null;
  else if (provider === 'lever') items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : null;
  else if (provider === 'ashby') items = Array.isArray(payload?.jobs) ? payload.jobs : null;
  else if (provider === 'smartrecruiters') items = Array.isArray(payload?.content) ? payload.content : Array.isArray(payload?.postings) ? payload.postings : null;
  if (!items) throw new Error(`${provider} feed response did not contain the expected public jobs array.`);
  return items.map((item) => {
    const candidate = opportunityFromProviderItem(item, provider, source, null, feedUrl);
    if (!candidate) return null;
    const raw = [item.title, item.text, item.name, item.location?.name, item.categories?.location,
      item.content, item.descriptionPlain, item.descriptionHtml, item.description, item.jobAd?.sections?.map((x) => x.text).join(' ')]
      .filter(Boolean).map((value) => stripHtml(String(value))).join('\n').slice(0, 500000);
    return { candidate, item, rawText: raw || candidate.description || candidate.title };
  }).filter(Boolean);
}

export function shouldUseProviderAdapter(baseUrl, config = {}) {
  const adapter = String(config.adapter || '').toLowerCase();
  if (adapter === 'html' || adapter === 'generic_html') return null;
  return detectJobBoardProvider(baseUrl, adapter);
}
