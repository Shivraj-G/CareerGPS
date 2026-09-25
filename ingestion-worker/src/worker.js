import 'dotenv/config';
import crypto from 'node:crypto';

const backendUrl = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
const token = process.env.INTERNAL_SERVICE_TOKEN;
const sourceId = process.env.INGESTION_SOURCE_ID;
const runId = process.env.INGESTION_RUN_ID;
const sourceUrl = process.env.SOURCE_URL;

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
const extractionVersion = process.env.EXTRACTION_VERSION || 'phase8-v1';
const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

if (!token || !sourceId || !runId || !sourceUrl) {
  console.error('Missing BACKEND_URL, INTERNAL_SERVICE_TOKEN, INGESTION_SOURCE_ID, INGESTION_RUN_ID or SOURCE_URL.');
  process.exit(1);
}

if (!isUuid(sourceId) || !isUuid(runId)) {
  console.error('Invalid ingestion IDs. INGESTION_SOURCE_ID and INGESTION_RUN_ID must be real UUIDs returned by the backend. Do not leave the replace-with-... placeholders in .env.');
  console.error(`INGESTION_SOURCE_ID=${sourceId}`);
  console.error(`INGESTION_RUN_ID=${runId}`);
  process.exit(1);
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
  return html.match(re)?.[1]?.trim() || null;
}

function titleFromHtml(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null;
}

function extractOpportunity(html, finalUrl) {
  const text = stripHtml(html);
  const title = meta(html, 'og:title') || titleFromHtml(html);
  const deadlineMatch = text.match(/(?:last date|application deadline|closing date|deadline)\s*[:\-]?\s*([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i);
  const advertisementMatch = text.match(/(?:advertisement|advt\.?|notification)\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9\/-]{3,})/i);
  const location = /\bgoa\b/i.test(text) ? 'Goa' : null;

  return {
    title,
    organization: meta(html, 'author') || null,
    advertisement_number: advertisementMatch?.[1] || null,
    location,
    vacancies_total: null,
    application_deadline: deadlineMatch?.[1] || null,
    application_opening: null,
    description: text.slice(0, 5000) || null,
    requirements: [],
    career_ids: [],
    source_url: finalUrl,
    source_document_url: finalUrl,
    status: 'unknown',
    opportunity_type: 'government',
    extraction_status: 'needs_review'
  };
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${backendUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-internal-service-token': token,
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
    return body;
  } finally { clearTimeout(timer); }
}

async function fetchSource(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Goa-Career-Intelligence-Ingestion/phase8 (+manual-run)',
        'accept': 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8'
      }
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Source fetch timed out after ${timeoutMs}ms: ${url}`);
    }
    throw new Error(`Source fetch failed for ${url}: ${error?.message || error}`);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  try {
    const response = await fetchSource(sourceUrl);
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);

    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const rawText = contentType.includes('html') ? stripHtml(buffer.toString('utf8')) : null;
    const candidateData = contentType.includes('html')
      ? extractOpportunity(buffer.toString('utf8'), response.url)
      : {
          title: null, organization: null, advertisement_number: null, location: null,
          vacancies_total: null, application_deadline: null, application_opening: null,
          requirements: [], career_ids: [], source_url: response.url, source_document_url: response.url,
          status: 'unknown', opportunity_type: 'government', description: null,
          extraction_status: 'needs_review'
        };

    await request('/internal/v1/ingestion/candidates', {
      method: 'POST',
      body: JSON.stringify({
        run_id: runId,
        source_id: sourceId,
        document: {
          url: response.url,
          document_title: candidateData.title,
          content_hash: hash,
          fetched_at: new Date().toISOString(),
          raw_text: rawText,
          extraction_version: extractionVersion
        },
        candidate: {
          entity_type: 'opportunity',
          candidate_data: candidateData,
          extraction_version: extractionVersion,
          extraction_status: 'needs_review'
        }
      })
    });

    await request(`/internal/v1/ingestion/runs/${runId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: 'completed' })
    });
    console.log('Ingestion completed. Candidate submitted for review.');
  } catch (error) {
    console.error('Ingestion failed:', error.message);
    if (error.message.includes('INGESTION_RUN_NOT_ACTIVE')) {
      console.error('The configured INGESTION_RUN_ID is no longer active. Create a NEW ingestion run and update INGESTION_RUN_ID in ingestion-worker/.env before retrying.');
    }
    if (error.message.includes('Source fetch failed') || error.message.includes('Source fetch timed out')) {
      console.error(`Check SOURCE_URL in ingestion-worker/.env. It must be a reachable public official source: ${sourceUrl}`);
    }
    try {
      await request(`/internal/v1/ingestion/runs/${runId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'failed', error_message: error.message })
      });
    } catch (statusError) {
      console.error('Could not update run status:', statusError.message);
    }
    process.exit(1);
  }
}

main();
