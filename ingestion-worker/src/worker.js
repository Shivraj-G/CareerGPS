import 'dotenv/config';
import crypto from 'node:crypto';
import { isUuid, stripHtml, extractOpportunity, extractLinks, looksLikeOpportunityDetail, canonicalizeUrl } from './extract.js';
import { detectJobBoardProvider, providerFeedUrl, parseProviderFeed, shouldUseProviderAdapter } from './providers.js';
import { RobotsPolicy, ROBOTS_USER_AGENT } from './robots.js';

const backendUrl = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
const token = process.env.INTERNAL_SERVICE_TOKEN;
const mode = (process.env.INGESTION_MODE || 'registry').toLowerCase();
const timeoutMs = clampNumber(process.env.REQUEST_TIMEOUT_MS, 15000, 1000, 120000);
const maxResponseBytes = clampNumber(process.env.MAX_RESPONSE_BYTES, 5_000_000, 100_000, 20_000_000);
const maxPagesDefault = clampNumber(process.env.MAX_PAGES_PER_SOURCE, 30, 1, 300);
const maxCandidatesDefault = clampNumber(process.env.MAX_CANDIDATES_PER_SOURCE, 100, 1, 1000);
const maxDepthDefault = clampNumber(process.env.MAX_CRAWL_DEPTH, 2, 0, 5);
const minDelayMs = clampNumber(process.env.MIN_REQUEST_DELAY_MS, 1000, 0, 30000);
const cliSourceType = process.argv.find((a) => a.startsWith('--source-types='))?.split('=')[1]?.trim();
const sourceTypeFilter = new Set(String(cliSourceType || process.env.SOURCE_TYPES || '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean));
const cliSourceId = process.argv.find((a) => a.startsWith('--source-id='))?.split('=')[1]?.trim();
const hasSourceIdArg = process.argv.some((a) => a.startsWith('--source-id='));
const runAllSources = process.argv.includes('--all-sources') || (hasSourceIdArg && !cliSourceId) || cliSourceId === 'all';
const sourceIdFilter = runAllSources ? '' : String(cliSourceId ?? process.env.INGESTION_SOURCE_ID ?? '').trim();
const extractionVersion = process.env.EXTRACTION_VERSION || 'multi-source-v2';
const dryRun = process.argv.includes('--dry-run') || String(process.env.DRY_RUN || '').toLowerCase() === 'true';
const requestTimes = new Map();

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

if (!token) {
  console.error('Missing INTERNAL_SERVICE_TOKEN. Set the same internal service token used by the backend.');
  process.exit(1);
}
if (!['registry', 'legacy'].includes(mode)) {
  console.error('INGESTION_MODE must be registry or legacy.');
  process.exit(1);
}
if (mode === 'legacy') {
  if (!process.env.SOURCE_URL || !isUuid(process.env.INGESTION_SOURCE_ID) || !isUuid(process.env.INGESTION_RUN_ID)) {
    console.error('Legacy mode requires SOURCE_URL and real UUID values for INGESTION_SOURCE_ID and INGESTION_RUN_ID.');
    process.exit(1);
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Backend request timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    const response = await fetch(`${backendUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-internal-service-token': token,
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.error?.message || body?.message || JSON.stringify(body);
      const error = new Error(`Backend ${response.status} ${path}: ${message}`);
      error.status = response.status;
      error.code = body?.error?.code;
      throw error;
    }
    return body?.data ?? body;
  } finally {
    clearTimeout(timer);
  }
}

async function rawFetch(urlValue, { accept = 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5', maxBytes = maxResponseBytes, maxRetries = 2 } = {}) {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(urlValue, {
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': ROBOTS_USER_AGENT, accept }
      });
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new Error(`Response exceeds ${maxBytes} byte limit: ${urlValue}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > maxBytes) throw new Error(`Response exceeds ${maxBytes} byte limit: ${urlValue}`);

      // Bounded retry on transient 5xx server gateway/unavailable responses
      if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, attempt * 500));
        continue;
      }

      return {
        ok: response.ok,
        status: response.status,
        url: response.url || urlValue,
        contentType: response.headers.get('content-type') || '',
        headers: response.headers,
        bytes,
        text: bytes.toString('utf8')
      };
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (attempt < maxRetries) {
          attempt += 1;
          await new Promise((r) => setTimeout(r, attempt * 500));
          continue;
        }
        throw new Error(`Fetch timed out after ${timeoutMs}ms: ${urlValue}`);
      }
      if (attempt < maxRetries && !error.message?.includes('byte limit')) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, attempt * 500));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

const robots = new RobotsPolicy(async (url) => {
  const result = await rawFetch(url, { accept: 'text/plain,*/*;q=0.1', maxBytes: 500_000 });
  return { ok: result.ok, status: result.status, text: result.text };
});

async function waitForDomain(url, extraDelay = 0) {
  const origin = new URL(url).origin;
  const requiredDelay = Math.max(minDelayMs, extraDelay);
  const last = requestTimes.get(origin) || 0;
  const wait = Math.max(0, last + requiredDelay - Date.now());
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  requestTimes.set(origin, Date.now());
}

async function fetchPublic(url, { checkRobots = true, allowedDomains = [], providerFeed = false, delayMs = minDelayMs } = {}) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    const err = new Error(`Only public HTTP(S) URLs are supported: ${url}`);
    err.code = 'INVALID_PROTOCOL';
    throw err;
  }
  if (checkRobots) {
    const policy = await robots.check(url);
    if (!policy.allowed) {
      const err = new Error(`Skipped ${url}: ${policy.reason}`);
      err.code = policy.code || 'BLOCKED_BY_ROBOTS';
      err.reason = policy.reason;
      err.blocked = true;
      throw err;
    }
    await waitForDomain(url, Math.max(policy.crawlDelay || 0, delayMs));
  } else {
    await waitForDomain(url, delayMs);
  }
  const result = await rawFetch(url);
  if (!result.ok) {
    const err = new Error(`Source returned HTTP ${result.status}: ${url}`);
    err.status = result.status;
    if ([401, 403].includes(result.status)) {
      err.code = 'ACCESS_DENIED';
      err.blocked = true;
      err.reason = `HTTP ${result.status} Forbidden`;
    }
    throw err;
  }
  const final = new URL(result.url);
  const startHost = parsed.hostname.toLowerCase();
  const allow = new Set([startHost, ...allowedDomains.map((x) => String(x).toLowerCase())]);
  // Public ATS adapters legitimately transform a hosted board URL into the vendor's documented public feed.
  if (providerFeed) {
    const permittedProviderHosts = new Set(['boards-api.greenhouse.io', 'api.lever.co', 'api.eu.lever.co', 'api.ashbyhq.com', 'api.smartrecruiters.com']);
    if (!allow.has(final.hostname.toLowerCase()) && !permittedProviderHosts.has(final.hostname.toLowerCase())) {
      throw new Error(`Public job-board feed redirected to an unapproved host: ${final.hostname}`);
    }
  } else if (!allow.has(final.hostname.toLowerCase())) {
    throw new Error(`Source redirected outside its configured host allowlist: ${final.hostname}`);
  }
  return result;
}

function parseSourceSettings(source) {
  let config = {};
  if (typeof source.access_notes === 'string' && source.access_notes.trim().startsWith('{')) {
    try { config = JSON.parse(source.access_notes); } catch { config = {}; }
  }
  const workerConfig = config.worker && typeof config.worker === 'object' ? config.worker : config;
  return {
    adapter: workerConfig.adapter || null,
    startUrls: Array.isArray(workerConfig.start_urls) ? workerConfig.start_urls.filter((x) => typeof x === 'string') : [source.base_url],
    allowedDomains: Array.isArray(workerConfig.allowed_domains) ? workerConfig.allowed_domains : [],
    maxPages: clampNumber(workerConfig.max_pages, maxPagesDefault, 1, 300),
    maxCandidates: clampNumber(workerConfig.max_candidates, maxCandidatesDefault, 1, 1000),
    maxDepth: clampNumber(workerConfig.max_depth, maxDepthDefault, 0, 5),
    delayMs: clampNumber(workerConfig.delay_ms, minDelayMs, 0, 30000),
    defaultLocation: typeof workerConfig.default_location === 'string' ? workerConfig.default_location.slice(0, 200) : null,
    includePatterns: Array.isArray(workerConfig.include_patterns) ? workerConfig.include_patterns : [],
    excludePatterns: Array.isArray(workerConfig.exclude_patterns) ? workerConfig.exclude_patterns : []
  };
}

function matchesConfig(url, settings) {
  if (settings.includePatterns.length && !settings.includePatterns.some((pattern) => safeRegex(pattern).test(url))) return false;
  if (settings.excludePatterns.some((pattern) => safeRegex(pattern).test(url))) return false;
  return true;
}
function safeRegex(pattern) {
  try { return new RegExp(String(pattern), 'i'); } catch { return /$a/; }
}

function normalizeText(data, max = 500000) {
  const text = String(data || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, max);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function providerTypeFromSource(source) {
  return String(source.source_type || '').toLowerCase();
}

function sourceCandidateAllowed(source, candidate) {
  const sourceType = providerTypeFromSource(source);
  const requested = sourceTypeFilter;
  if (!requested.size) return true;
  const category = String(candidate?.opportunity_type || '').toLowerCase();
  return requested.has(sourceType) || requested.has(category) || [...requested].some((filter) => sourceType.includes(filter) || category.includes(filter));
}

async function submitCandidate({ source, runId, candidate, documentUrl, rawText, contentType = 'text/html', dry = false }) {
  const finalUrl = canonicalizeUrl(candidate.source_url || documentUrl);
  const data = {
    ...candidate,
    title: typeof candidate.title === 'string' ? candidate.title.trim().slice(0, 300) : candidate.title,
    organization: candidate.organization || source.organization || null,
    source_url: finalUrl,
    source_document_url: candidate.source_document_url ? canonicalizeUrl(candidate.source_document_url) : finalUrl,
    opportunity_type: candidate.opportunity_type || defaultOpportunityType(source.source_type),
    location: candidate.location || source.default_location || null
  };
  if (!data.title) return { submitted: false, reason: 'missing title' };
  if (!data.organization) console.warn(`[${source.name}] Organization missing for candidate: ${data.title}; it will need reviewer correction.`);
  if (!sourceCandidateAllowed(source, data)) return { submitted: false, reason: 'excluded by SOURCE_TYPES filter' };
  const raw = normalizeText(rawText || data.description || data.title, 500000);
  const contentHash = sha256(raw || finalUrl);
  if (dry) {
    console.log(`[DRY RUN] ${data.opportunity_type}: ${data.title} | ${data.organization || 'organization unconfirmed'} | ${data.location || 'location unconfirmed'} | ${data.source_url}`);
    return { submitted: false, dryRun: true, previewed: true };
  }
  const response = await request('/internal/v1/ingestion/candidates', {
    method: 'POST',
    body: JSON.stringify({
      run_id: runId,
      source_id: source.id,
      document: {
        url: documentUrl,
        document_title: data.title,
        content_hash: contentHash,
        fetched_at: new Date().toISOString(),
        published_at: data.source_published_at || null,
        raw_text: raw.slice(0, 500000),
        extraction_version: extractionVersion
      },
      candidate: {
        entity_type: 'opportunity',
        candidate_data: data,
        extraction_status: 'needs_review'
      }
    })
  });
  if (response?.duplicate) return { submitted: false, duplicate: true };
  if (response?.updated) return { submitted: true, updated: true };
  return { submitted: true, inserted: true };
}

function defaultOpportunityType(sourceType = '') {
  const value = String(sourceType).toLowerCase();
  if (/intern/.test(value)) return 'internship';
  if (/apprentice/.test(value)) return 'apprenticeship';
  if (/scholarship|fellowship/.test(value)) return 'scholarship';
  if (/government|govt|public.?service|public.?sector|psc/.test(value)) return 'government_recruitment';
  return 'private_job';
}

function extractOpportunityLinks(html, baseUrl, settings) {
  return extractLinks(html, baseUrl, {
    allowedDomains: settings.allowedDomains,
    maxLinks: Math.max(50, settings.maxPages * 15)
  }).filter((link) => matchesConfig(link.url, settings));
}

async function processProviderSource(source, settings, runId, { dry = false } = {}) {
  const provider = shouldUseProviderAdapter(settings.startUrls[0] || source.base_url, settings);
  if (!provider) return null;
  const sourceUrl = settings.startUrls[0] || source.base_url;
  const feedUrl = providerFeedUrl(sourceUrl, provider);
  console.log(`[${source.name}] Using public ${provider} job-board feed: ${feedUrl}`);
  let response;
  try {
    response = await fetchPublic(feedUrl, { checkRobots: true, allowedDomains: settings.allowedDomains, providerFeed: true, delayMs: settings.delayMs });
  } catch (error) {
    const isBlocked = error?.blocked || error?.code === 'BLOCKED_BY_ROBOTS' || error?.code === 'ACCESS_DENIED';
    return {
      provider,
      discovered: 0,
      submitted: 0,
      inserted: 0,
      updated: 0,
      duplicates: 0,
      previewed: 0,
      skipped: 0,
      pagesAttempted: 1,
      pagesFetched: 0,
      pagesParsed: 0,
      pagesBlocked: isBlocked ? 1 : 0,
      pageFailures: isBlocked ? 0 : 1,
      blockedReason: isBlocked ? (error.reason || error.message) : null,
      failureReason: isBlocked ? null : error.message
    };
  }

  if (!/json/i.test(response.contentType) && !response.text.trim().startsWith('{') && !response.text.trim().startsWith('[')) {
    throw new Error(`${provider} endpoint did not return JSON; received ${response.contentType || 'unknown content type'}.`);
  }
  const payload = JSON.parse(response.text);
  const items = parseProviderFeed(payload, provider, source, response.url);
  let submitted = 0; let inserted = 0; let updated = 0; let skipped = 0; let duplicates = 0; let previewed = 0;
  const seenItems = new Set();
  for (const item of items.slice(0, settings.maxCandidates)) {
    const itemKey = item.candidate.advertisement_number || canonicalizeUrl(item.candidate.source_url);
    if (itemKey && seenItems.has(itemKey)) {
      duplicates += 1;
      continue;
    }
    if (itemKey) seenItems.add(itemKey);

    const result = await submitCandidate({ source, runId, candidate: item.candidate, documentUrl: response.url, rawText: item.rawText, contentType: 'application/json', dry });
    if (result.submitted) {
      submitted += 1;
      if (result.updated) updated += 1;
      else inserted += 1;
    }
    else if (result.duplicate) duplicates += 1;
    else if (result.previewed) previewed += 1;
    else skipped += 1;
  }
  return {
    provider,
    discovered: items.length,
    submitted,
    inserted,
    updated,
    duplicates,
    previewed,
    skipped,
    pagesAttempted: 1,
    pagesFetched: 1,
    pagesParsed: 1,
    pagesBlocked: 0,
    pageFailures: 0
  };
}

async function processGenericSource(source, settings, runId, { dry = false } = {}) {
  const queue = settings.startUrls.map((url) => ({ url: canonicalizeUrl(url), depth: 0 }));
  const seenPages = new Set();
  const seenOpportunityUrls = new Set();
  let submitted = 0; let inserted = 0; let updated = 0; let skipped = 0; let duplicates = 0; let previewed = 0; let discovered = 0;
  let pagesAttempted = 0;
  let pagesFetched = 0;
  let pagesBlocked = 0;
  let pageFailures = 0;
  let pagesParsed = 0;
  let firstBlockReason = null;
  let firstFailureReason = null;
  let processedCandidates = 0;

  while (queue.length && pagesAttempted < settings.maxPages && processedCandidates < settings.maxCandidates) {
    const current = queue.shift();
    const normalized = canonicalizeUrl(current.url);
    if (!normalized || seenPages.has(normalized) || !matchesConfig(normalized, settings)) continue;
    seenPages.add(normalized);
    pagesAttempted += 1;

    try {
      const response = await fetchPublic(normalized, { checkRobots: true, allowedDomains: settings.allowedDomains, delayMs: settings.delayMs });
      pagesFetched += 1;

      if (!/html|xhtml/i.test(response.contentType)) {
        if (/pdf/i.test(response.contentType) || /\.pdf(?:$|\?)/i.test(response.url)) {
          console.warn(`[${source.name}] Skipped PDF for now (no PDF extractor configured): ${response.url}`);
        } else {
          console.warn(`[${source.name}] Skipped non-HTML content type ${response.contentType || 'unknown'}: ${response.url}`);
        }
        continue;
      }
      const html = response.text;
      pagesParsed += 1;
      const text = stripHtml(html);
      const candidate = extractOpportunity(html, response.url, { sourceType: source.source_type, organization: source.organization, defaultLocation: settings.defaultLocation });
      const canonCandidateUrl = canonicalizeUrl(candidate.source_url);
      if (detail && candidate.title && !seenOpportunityUrls.has(canonCandidateUrl) && processedCandidates < settings.maxCandidates) {
        seenOpportunityUrls.add(canonCandidateUrl);
        discovered += 1;
        processedCandidates += 1;
        const result = await submitCandidate({ source, runId, candidate, documentUrl: response.url, rawText: text, dry });
        if (result.submitted) {
          submitted += 1;
          if (result.updated) updated += 1;
          else inserted += 1;
        }
        else if (result.duplicate) duplicates += 1;
        else if (result.previewed) previewed += 1;
        else skipped += 1;
      }
      if (current.depth < settings.maxDepth && queue.length + seenPages.size < settings.maxPages * 4) {
        const links = extractOpportunityLinks(html, response.url, settings);
        for (const link of links) {
          if (!seenPages.has(link.url) && !queue.some((item) => item.url === link.url)) queue.push({ url: link.url, depth: current.depth + 1 });
          if (queue.length >= settings.maxPages * 4) break;
        }
      }
    } catch (error) {
      if (error?.blocked || error?.code === 'BLOCKED_BY_ROBOTS' || error?.code === 'ACCESS_DENIED') {
        pagesBlocked += 1;
        if (!firstBlockReason) firstBlockReason = error.reason || error.message;
        console.warn(`[${source.name}] Page blocked: ${normalized} — ${error.message}`);
      } else {
        pageFailures += 1;
        if (!firstFailureReason) firstFailureReason = error.message;
        console.warn(`[${source.name}] Page fetch failed: ${normalized} — ${error.message}`);
      }
    }
  }

  return {
    discovered,
    submitted,
    inserted,
    updated,
    duplicates,
    previewed,
    skipped,
    pagesAttempted,
    pagesFetched,
    pagesParsed,
    pagesBlocked,
    pageFailures,
    blockedReason: pagesBlocked > 0 && pagesFetched === 0 ? firstBlockReason : null,
    failureReason: pageFailures > 0 && pagesFetched === 0 ? firstFailureReason : null
  };
}

async function executeSource(source, { existingRunId = null, dry = false } = {}) {
  if (!source?.id || !isUuid(source.id)) throw new Error('Source record has no valid UUID.');
  if (!source.base_url || !/^https?:\/\//i.test(source.base_url)) throw new Error(`Source ${source.name || source.id} has an invalid base_url.`);
  const settings = parseSourceSettings(source);
  source.default_location = settings.defaultLocation;
  if (!settings.startUrls.length) throw new Error(`Source ${source.name} has no start URLs.`);
  for (const url of settings.startUrls) {
    try { new URL(url); } catch { throw new Error(`Invalid start URL in source ${source.name}: ${url}`); }
  }
  let runId = existingRunId;
  if (!runId && !dry) {
    const run = await request('/internal/v1/ingestion/runs', {
      method: 'POST', body: JSON.stringify({ source_id: source.id, notes: `Auto-created by multi-source ingestion worker ${extractionVersion}` })
    });
    runId = run.id || run.data?.id;
    if (!isUuid(runId)) throw new Error(`Backend did not return a valid ingestion run ID for ${source.name}.`);
  }
  if (runId && !isUuid(runId)) throw new Error(`Invalid run UUID for source ${source.name}.`);
  console.log(`\n[${source.name}] source_type=${source.source_type} run=${runId || 'dry-run'}`);

  try {
    let results = null;
    const provider = shouldUseProviderAdapter(settings.startUrls[0] || source.base_url, settings);
    if (provider) results = await processProviderSource(source, settings, runId, { dry });
    if (!results) results = await processGenericSource(source, settings, runId, { dry });

    // Determine precise source outcome
    let status = 'completed';
    let errorMessage = null;

    if (results.pagesFetched === 0 && results.pagesBlocked > 0) {
      status = 'blocked';
      errorMessage = results.blockedReason || 'Blocked by access policy: robots.txt returned a forbidden response (requires review)';
    } else if (results.pagesFetched === 0 && results.pageFailures > 0) {
      status = 'failed';
      errorMessage = results.failureReason || `All ${results.pagesAttempted} page fetch attempts failed`;
    } else if (results.pagesFetched === 0 && results.pagesAttempted === 0) {
      status = 'failed';
      errorMessage = 'No valid pages were configured or matched for crawling';
    }

    if (status === 'completed') {
      if (!dry && runId) {
        await request(`/internal/v1/ingestion/runs/${runId}/status`, {
          method: 'POST',
          body: JSON.stringify({
            status: 'completed',
            discovered_count: results.discovered,
            extracted_count: results.submitted,
            error_message: null
          })
        });
      }
      console.log(`[${source.name}] completed: ${JSON.stringify(results)}`);
      return { source: source.name, status: 'completed', runId, ...results };
    } else if (status === 'blocked') {
      console.warn(`[${source.name}] blocked (requires review): ${errorMessage}`);
      if (!dry && runId) {
        try {
          await request(`/internal/v1/ingestion/runs/${runId}/status`, {
            method: 'POST',
            body: JSON.stringify({
              status: 'failed',
              error_message: `blocked: ${errorMessage}; requires manual review`
            })
          });
        } catch (statusError) {
          console.error(`[${source.name}] could not mark run status: ${statusError.message}`);
        }
      }
      return { source: source.name, status: 'blocked', runId, error: errorMessage, ...results };
    } else {
      console.error(`[${source.name}] failed: ${errorMessage}`);
      if (!dry && runId) {
        try {
          await request(`/internal/v1/ingestion/runs/${runId}/status`, {
            method: 'POST',
            body: JSON.stringify({
              status: 'failed',
              error_message: errorMessage
            })
          });
        } catch (statusError) {
          console.error(`[${source.name}] could not mark run failed: ${statusError.message}`);
        }
      }
      return { source: source.name, status: 'failed', runId, error: errorMessage, ...results };
    }
  } catch (error) {
    console.error(`[${source.name}] unexpected error: ${error.message}`);
    if (!dry && runId) {
      try {
        await request(`/internal/v1/ingestion/runs/${runId}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: 'failed', error_message: String(error.message).slice(0, 4900) })
        });
      } catch (statusError) {
        console.error(`[${source.name}] could not mark run failed: ${statusError.message}`);
      }
    }
    return {
      source: source.name,
      status: 'failed',
      runId,
      error: error.message,
      pagesAttempted: 0,
      pagesFetched: 0,
      pagesBlocked: 0,
      pageFailures: 1,
      discovered: 0,
      submitted: 0,
      previewed: 0
    };
  }
}

async function loadApprovedSources() {
  const result = await request('/internal/v1/ingestion/sources', { method: 'GET' });
  const sources = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
  return sources;
}

async function runRegistryMode() {
  let sources = await loadApprovedSources();
  if (sourceIdFilter) {
    if (!isUuid(sourceIdFilter)) throw new Error('INGESTION_SOURCE_ID filter must be a real source UUID.');
    sources = sources.filter((source) => source.id === sourceIdFilter);
  }
  if (sourceTypeFilter.size) {
    sources = sources.filter((source) => {
      const value = String(source.source_type || '').toLowerCase();
      return [...sourceTypeFilter].some((filter) => value.includes(filter));
    });
  }
  const maxSources = clampNumber(process.env.MAX_SOURCES_PER_RUN, 100, 1, 1000);
  sources = sources.slice(0, maxSources);
  if (!sources.length) {
    console.log('No approved ingestion sources matched. Add and approve public government, private-career, internship, or apprenticeship sources in the admin source registry.');
    return { attempted: 0, completed: 0, blocked: 0, failed: 0, candidates: 0 };
  }
  console.log(`Found ${sources.length} approved source(s). Mode=${dryRun ? 'dry-run' : 'registry'}.`);
  const results = [];
  for (const source of sources) {
    results.push(await executeSource(source, { dry: dryRun }));
  }
  const summary = {
    attempted: results.length,
    completed: results.filter((r) => r.status === 'completed').length,
    blocked: results.filter((r) => r.status === 'blocked').length,
    failed: results.filter((r) => r.status === 'failed').length,
    pagesAttempted: results.reduce((sum, r) => sum + Number(r.pagesAttempted || 0), 0),
    pagesFetched: results.reduce((sum, r) => sum + Number(r.pagesFetched || 0), 0),
    pagesBlocked: results.reduce((sum, r) => sum + Number(r.pagesBlocked || 0), 0),
    pagesFailed: results.reduce((sum, r) => sum + Number(r.pageFailures || 0), 0),
    discovered: results.reduce((sum, r) => sum + Number(r.discovered || 0), 0),
    candidates: results.reduce((sum, r) => sum + Number(r.submitted || 0) + Number(r.previewed || 0), 0),
    submitted: results.reduce((sum, r) => sum + Number(r.submitted || 0), 0),
    inserted: results.reduce((sum, r) => sum + Number(r.inserted || 0), 0),
    updated: results.reduce((sum, r) => sum + Number(r.updated || 0), 0),
    previewed: results.reduce((sum, r) => sum + Number(r.previewed || 0), 0),
    duplicates: results.reduce((sum, r) => sum + Number(r.duplicates || 0), 0),
    sources: results
  };
  console.log(`\nINGESTION SUMMARY ${JSON.stringify(summary, null, 2)}`);
  if (summary.failed > 0 || (summary.blocked > 0 && summary.completed === 0)) process.exitCode = 1;
  return summary;
}

async function runLegacyMode() {
  const source = {
    id: process.env.INGESTION_SOURCE_ID,
    name: process.env.SOURCE_NAME || 'Legacy configured source',
    source_type: process.env.SOURCE_TYPE || 'government_recruitment',
    base_url: process.env.SOURCE_URL,
    organization: process.env.SOURCE_ORGANIZATION || null,
    access_notes: process.env.SOURCE_ACCESS_NOTES || null
  };
  const result = await executeSource(source, { existingRunId: process.env.INGESTION_RUN_ID, dry: dryRun });
  if (result.status !== 'completed') process.exitCode = 1;
  return result;
}

async function main() {
  try {
    if (dryRun) console.log('DRY RUN enabled: source pages will be fetched, but no ingestion runs or candidates will be written.');
    if (mode === 'legacy') await runLegacyMode();
    else await runRegistryMode();
  } catch (error) {
    console.error(`Ingestion worker stopped: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
