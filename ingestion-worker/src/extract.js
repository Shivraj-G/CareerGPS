const HTML_ENTITY_MAP = {
  '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&lt;': '<', '&gt;': '>', '&ndash;': '–', '&mdash;': '—', '&rsquo;': '’', '&lsquo;': '‘',
  '&rdquo;': '”', '&ldquo;': '“', '&bull;': '•', '&copy;': '©', '&reg;': '®', '&hellip;': '…'
};

export function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function decodeHtmlEntities(input = '') {
  return String(input)
    .replace(/&(?:nbsp|amp|quot|#39|apos|lt|gt|ndash|mdash|rsquo|lsquo|rdquo|ldquo|bull|copy|reg|hellip);/gi, (entity) => {
      const lower = entity.toLowerCase();
      return HTML_ENTITY_MAP[lower] ?? entity;
    })
    .replace(/&#(\d+);/g, (_, number) => {
      const code = Number(number);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([\da-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    });
}

export function stripHtml(html = '') {
  return decodeHtmlEntities(String(html))
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|section|article|ul|ol)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u00a0\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function meta(html, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Support both attribute orderings: name=... content=... and content=... name=...
  const tags = String(html).match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const nameValue = tag.match(/\b(?:name|property)\s*=\s*(["'])(.*?)\1/i)?.[2];
    const contentValue = tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (nameValue && new RegExp(`^${escaped}$`, 'i').test(nameValue)) return decodeHtmlEntities(contentValue || '').trim() || null;
  }
  return null;
}

export function titleFromHtml(html) {
  const raw = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1];
  return raw ? stripHtml(raw).slice(0, 500) || null : null;
}

function cleanText(value, max = 5000) {
  if (typeof value !== 'string') return null;
  const result = stripHtml(value).replace(/\s+/g, ' ').trim();
  return result ? result.slice(0, max) : null;
}

function findJsonLdJobPostings(html) {
  const scripts = String(html).match(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>[\s\S]*?<\/script\s*>/gi) || [];
  const output = [];
  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node !== 'object') return;
    const type = node['@type'];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((entry) => String(entry || '').toLowerCase() === 'jobposting')) output.push(node);
    if (node['@graph']) visit(node['@graph']);
    if (node.itemListElement) visit(node.itemListElement);
  };
  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script\s*>$/i, '').trim();
    try { visit(JSON.parse(body)); } catch { /* malformed JSON-LD is ignored, never treated as evidence */ }
  }
  return output;
}

export function hasJobPostingJsonLd(html) {
  return findJsonLdJobPostings(html).length > 0;
}

function normalizeDate(value, { endOfDay = false } = {}) {
  if (!value) return null;
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const text = String(value).trim();
  if (!text) return null;
  let year; let month; let day;
  let match = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (match) { year = Number(match[1]); month = Number(match[2]); day = Number(match[3]); }
  if (!match) {
    match = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
    if (match) {
      day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
      if (year < 100) year += year < 50 ? 2000 : 1900;
    }
  }
  if (match) {
    const date = new Date(Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.toISOString();
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay && !/T\d{2}:\d{2}/.test(text)) parsed.setUTCHours(23, 59, 59, 0);
  return parsed.toISOString();
}

function flattenLocation(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) return value.map(flattenLocation).filter(Boolean).join(' / ') || null;
  if (typeof value === 'object') {
    if (value.name) return String(value.name).trim() || null;
    const address = value.address || value;
    const pieces = [address.addressLocality, address.addressRegion, address.addressCountry?.name || address.addressCountry]
      .filter((item) => typeof item === 'string' && item.trim());
    return pieces.join(', ') || null;
  }
  return null;
}

function normalizeOpportunityType(sourceType, title = '', body = '', url = '') {
  const source = String(sourceType || '').toLowerCase().replace(/[_-]+/g, ' ');
  const text = `${title} ${url} ${body.slice(0, 5000)}`.toLowerCase();
  if (/\b(internship|internships|intern|summer intern|winter intern)\b/.test(text) || /intern/.test(source)) return 'internship';
  if (/\b(apprentice|apprenticeship|trainee program|graduate trainee)\b/.test(text) || /apprentice/.test(source)) return 'apprenticeship';
  if (/\b(scholarship|fellowship|grant)\b/.test(text) || /scholarship|fellowship/.test(source)) return 'scholarship';
  if (/\b(graduate programme|graduate program|management trainee|early careers? programme|campus hiring)\b/.test(text)) return 'graduate_programme';
  if (/government|govt|public service|public sector|psc|government recruitment/.test(source)) return 'government_recruitment';
  if (/private|corporate|company|employer|industry|career|job board|job site|private sector/.test(source)) return 'private_job';
  if (/\b(contract|full[- ]time|part[- ]time|permanent|job opening|position|vacancy|vacancies|hiring)\b/.test(text)) return 'private_job';
  return sourceType ? String(sourceType).trim().toLowerCase().replace(/\s+/g, '_').slice(0, 50) : 'unknown';
}

function parseJsonLdOpportunity(job, finalUrl, options) {
  const hiring = job.hiringOrganization;
  const organization = typeof hiring === 'string' ? hiring : hiring?.name || options.organization || null;
  const location = flattenLocation(job.jobLocation) || (job.jobLocationType === 'TELECOMMUTE' ? 'Remote' : options.defaultLocation || null);
  const title = cleanText(job.title, 300);
  const description = cleanText(job.description, 5000);
  const requirementsText = [job.qualifications, job.educationRequirements, job.experienceRequirements, job.skills]
    .flat(Infinity).filter((item) => typeof item === 'string').map((item) => cleanText(item, 1000)).filter(Boolean);
  const deadline = normalizeDate(job.validThrough, { endOfDay: true });
  const opening = normalizeDate(job.datePosted);
  const status = deadline && Date.parse(deadline) < Date.now() ? 'closed' : 'open';
  return {
    title, organization: organization ? String(organization).trim().slice(0, 250) : null,
    advertisement_number: job.identifier?.value ? String(job.identifier.value).slice(0, 150) : null,
    location, vacancies_total: null,
    application_deadline: deadline, application_opening: opening,
    description, requirements: requirementsText.map((requirement_text) => ({ requirement_type: 'qualification_or_experience', requirement_text, rule_data: {} })),
    career_ids: [], source_url: job.url || finalUrl, source_document_url: finalUrl,
    status, opportunity_type: normalizeOpportunityType(options.sourceType, title || '', description || '', finalUrl),
    source_type: options.sourceType || null, source_published_at: opening
  };
}

export function extractOpportunity(html, finalUrl, options = {}) {
  const sourceType = options.sourceType || 'government_recruitment';
  const sourceOrganization = options.organization || null;
  const jobs = findJsonLdJobPostings(html);
  if (jobs.length) return parseJsonLdOpportunity(jobs[0], finalUrl, { ...options, sourceType, organization: sourceOrganization });

  const text = stripHtml(html);
  const ogTitle = meta(html, 'og:title');
  let title = (ogTitle || titleFromHtml(html) || meta(html, 'twitter:title') || '').trim() || null;
  const bodyText = text.slice(0, 20000);

  const postNameMatch = bodyText.match(/(?:post name|name of (?:the )?post|position title|job title)\s*[:\-]\s*([A-Za-z0-9 ,()&./-]{3,150}?)(?=\s+(?:apply|department|max\s*age|scale\s*of\s*pay|pay\s*scale|last\s*date|start\s*date|application|essential|qualification|(?:no\.?\s*of\s*)?vacanc|(?:no\.?\s*of\s*)?posts?|[;\n\r]|$))/i);
  const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i);
  const h1Text = h1Match ? stripHtml(h1Match[1]).trim() : '';
  const isGenericTitle = !title || /\b(?:advertisement details|recruitment notice|recruitment notification|current openings|advertisements?|job openings?|vacancies|job details)\b/i.test(title);
  if (postNameMatch && isGenericTitle) {
    title = postNameMatch[1].trim();
  } else if (h1Text && isGenericTitle) {
    title = h1Text;
  }

  const deptMatch = bodyText.match(/(?:department name|name of (?:the )?department)\s*[:\-]\s*([A-Za-z0-9 ,()&./-]{3,150}?)(?=\s+(?:apply|post\s*name|max\s*age|scale\s*of\s*pay|pay\s*scale|last\s*date|start\s*date|application|essential|qualification|(?:no\.?\s*of\s*)?vacanc|(?:no\.?\s*of\s*)?posts?|[;\n\r]|$))/i);
  const advtNameMatch = bodyText.match(/(?:advertisement\s+(?:name|no\.?|number)|advt\.?\s*(?:no\.?|number)?|notification\s+(?:no\.?|number))\s*[:#\-]?\s*([A-Za-z0-9][A-Za-z0-9_./\- ]{1,50}?)(?=\s+(?:details|department|post|last\s*date|application|apply|[;\n\r]|$))/i);
  const advertisementMatch = advtNameMatch || bodyText.match(/(?:advertisement|advt\.?|notification|requisition|job\s+id|reference\s+number)\s*(?:no\.?|number|id)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9_./-]{2,})/i);
  const vacancyMatch = bodyText.match(/(?:no\.?\s*of\s*(?:vacancies|posts?|positions?|openings?)|vacancies|posts?|positions?)\s*[:\-]\s*(\d{1,4})\b/i)
    || bodyText.match(/\b(\d{1,4})\s+(?:vacanc(?:y|ies)|posts?|positions?|openings?)\b/i);
  const explicitOrganization = (deptMatch ? deptMatch[1].trim() : null) || meta(html, 'author') || meta(html, 'og:site_name') || sourceOrganization;
  const explicitLocation = bodyText.match(/(?:job location|work location|place of posting|location)\s*[:\-]\s*([A-Z][A-Za-z0-9 ,()&.-]{2,80}?)(?=\s+(?:employment type|job type|salary|deadline|apply now|responsibilities|requirements)\b|[.;]|$)/i)?.[1]?.trim();
  const location = explicitLocation || (/\bremote\b/i.test(title || '') ? 'Remote' : /\bgoa\b/i.test(`${title || ''} ${finalUrl}`) ? 'Goa' : options.defaultLocation || null);
  const deadlineMatch = bodyText.match(/(?:last date(?:\s+(?:to\s+apply|for\s+application|of\s+application))?|application (?:deadline|end date)|closing date|apply (?:before|by)|deadline|applications close(?: on)?)\s*[:\*\-]?\s*([0-9]{1,4}[./-][0-9]{1,2}[./-][0-9]{2,4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*\d{4})/i);
  const openingMatch = bodyText.match(/(?:posted on|published on|date posted|opening date|start date(?:\s+of\s+application)?|application start date|applications open(?: from)?)\s*[:\*\-]?\s*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})/i);
  const deadline = normalizeDate(deadlineMatch?.[1], { endOfDay: true });
  const opening = normalizeDate(openingMatch?.[1]);
  const now = Date.now();
  let status = 'unknown';
  if (deadline && Date.parse(deadline) < now) status = 'closed';
  else if (/\b(closed|applications closed|position filled|no longer accepting)\b/i.test(bodyText.slice(0, 10000))) status = 'closed';
  else if (/\b(apply now|apply today|applications open|accepting applications|open position)\b/i.test(bodyText.slice(0, 10000))) status = 'open';
  else if (opening && Date.parse(opening) > now) status = 'upcoming';
  else if (deadline && Date.parse(deadline) >= now) status = 'open';

  const reqMatch = bodyText.match(/(?:essential(?:\s+qualifications?)?\s*[:\-]|educational & other qualifications\s*[:-]|minimum qualifications\s*[:-]|qualifications\s*[:-])\s*([^\n\r]{5,500})/i);
  const requirements = [];
  if (reqMatch) {
    requirements.push({
      requirement_type: 'qualification_or_experience',
      requirement_text: reqMatch[1].trim().slice(0, 1000),
      rule_data: {}
    });
  }

  return {
    title: title?.slice(0, 300) || null,
    organization: explicitOrganization ? String(explicitOrganization).trim().slice(0, 250) || null : null,
    advertisement_number: advertisementMatch?.[1]?.slice(0, 150) || null,
    location,
    vacancies_total: vacancyMatch ? Number(vacancyMatch[1]) : null,
    application_deadline: deadline,
    application_opening: opening,
    description: bodyText.slice(0, 5000) || null,
    requirements,
    career_ids: [],
    source_url: finalUrl,
    source_document_url: finalUrl,
    status,
    opportunity_type: normalizeOpportunityType(sourceType, title || '', bodyText, finalUrl),
    source_type: sourceType,
    source_published_at: opening
  };
}

const LINK_TITLE_WORDS = /\b(job|jobs|career|careers|opening|openings|position|positions|vacanc\w*|recruit\w*|internship\w*|intern\w*|graduate\w*|trainee\w*|apprentice\w*|fellowship\w*|scholarship\w*|programme\w*|program\w*|advertis\w*|advt\w*|notification\w*|notices?)\b/i;
const EXCLUDED_LINKS = /\b(login|log-in|signin|sign-in|register|privacy|cookie|terms|contact|about-us|press|newsroom|support|help|logout|signout)\b/i;

export function extractLinks(html, baseUrl, options = {}) {
  const maxLinks = Number.isInteger(options.maxLinks) ? options.maxLinks : 250;
  const allowedHosts = new Set((options.allowedDomains || []).map((domain) => String(domain).toLowerCase().replace(/^\./, '')));
  try { allowedHosts.add(new URL(baseUrl).hostname.toLowerCase()); } catch { return []; }
  const output = [];
  const seen = new Set();
  const anchorTags = String(html).match(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi) || [];
  for (const tag of anchorTags) {
    if (output.length >= maxLinks) break;
    const hrefRaw = tag.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || tag.match(/\bhref\s*=\s*([^\s>]+)/i)?.[1];
    if (!hrefRaw) continue;
    const label = stripHtml(tag.replace(/<a\b[^>]*>/i, '').replace(/<\/a\s*>$/i, '')).slice(0, 300);
    try {
      const url = new URL(decodeHtmlEntities(hrefRaw), baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      if (url.username || url.password) continue;
      if (!allowedHosts.has(url.hostname.toLowerCase())) continue;
      if (/\.(?:pdf|docx?|xlsx?|pptx?|zip|png|jpe?g|gif|svg|webp|mp4|mp3)(?:$|\?)/i.test(url.pathname)) continue;
      const combined = `${label} ${url.pathname} ${url.search}`;
      const hasJobWord = LINK_TITLE_WORDS.test(combined);
      const hasIdParam = url.searchParams.has('id') && /(?:advertis|job|post|vacanc|recruit)/i.test(url.pathname);
      if (!hasJobWord && !hasIdParam) continue;
      if (EXCLUDED_LINKS.test(combined)) continue;
      url.hash = '';
      for (const key of [...url.searchParams.keys()]) if (/^(utm_|ref$|source$|tracking|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
      const normalized = url.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      output.push({ url: normalized, label: label || null });
    } catch { /* bad links are ignored */ }
  }
  return output;
}

export function looksLikeOpportunityDetail(html, url = '') {
  if (hasJobPostingJsonLd(html)) return true;
  const title = `${meta(html, 'og:title') || ''} ${titleFromHtml(html) || ''}`.trim();
  const text = stripHtml(html).slice(0, 25000);
  // Avoid converting generic career landing/list pages into one fake job.
  if (/\b(careers?\s*(?:page|at|home)?|current openings|open positions|job listings|search jobs|all jobs|all internships|internships? at|join our team|work with us)\b/i.test(title)) return false;
  if (/\b(please log ?in to continue|captcha|access denied|verify you are human|robot check|enable javascript to continue)\b/i.test(text.slice(0, 3000)) || /^(?:user\s+)?(?:log[- ]?in|sign[- ]?in)(?:\s*[-–|].*)?$/i.test(title)) return false;
  const signalCount = [
    /\b(responsibilities|what you(?:'|’)ll do|role overview|about the role|job description)\b/i,
    /\b(requirements|qualifications|what you(?:'|’)ll bring|skills and experience|minimum qualifications)\b/i,
    /\b(apply now|apply for this job|submit application|application process)\b/i,
    /\b(employment type|full[- ]time|part[- ]time|internship|apprenticeship|salary range|compensation)\b/i
  ].filter((pattern) => pattern.test(text)).length;
  const govSignalCount = [
    /\b(?:post name|name of (?:the )?post|position title)\s*[:\-]/i,
    /\b(?:scale of pay|pay scale|pay matrix|level\s*-\s*\d+)\b/i,
    /\b(?:essential|educational & other qualifications|qualifications|eligibility)\b/i,
    /\b(?:last date(?:\s+of\s+application)?|application (?:deadline|end date)|closing date)\s*[:\*\-]?/i,
    /\b(?:advertisement\s+(?:name|no\.?|number)|advt\.?\s*no\.?|notification\s*no\.?)\b/i,
    /\b(?:no\.?\s*of\s*(?:vacancies|posts?)|vacancies|posts?)\s*[:\-]\s*\d+\b/i
  ].filter((pattern) => pattern.test(text)).length;
  let parsedUrl;
  try { parsedUrl = new URL(url || 'https://example.com'); } catch { parsedUrl = { pathname: '', searchParams: new URLSearchParams() }; }
  const urlSuggestsDetail = /\/(?:jobs?|positions?|openings?|careers?|internships?|job-detail|job-details|recruitment|recruit)\/[^/]{2,}/i.test(parsedUrl.pathname)
    || /\/(?:advt|advertisement|notice|recruitment)[-_0-9a-z.]+/i.test(parsedUrl.pathname)
    || (parsedUrl.searchParams.has('id') && /(?:advertis|job|post|vacanc|recruit)/i.test(parsedUrl.pathname));
  const isGovDetail = govSignalCount >= 3 || (govSignalCount >= 2 && (urlSuggestsDetail || /\bpost name\s*:/i.test(text)));
  const isGenericDetail = signalCount >= 2 && (urlSuggestsDetail || title.length >= 4);
  return Boolean(isGovDetail || isGenericDetail);
}

export function opportunityFromProviderItem(item, provider, source, detailUrl, feedUrl) {
  const sourceType = source.source_type || 'private_careers';
  let title = null; let organization = null; let location = null; let description = null;
  let id = null; let opening = null; let deadline = null; let url = detailUrl || feedUrl; let employmentType = '';
  if (provider === 'greenhouse') {
    title = item.title; organization = source.organization || null; location = item.location?.name || item.offices?.map((x) => x.location || x.name).filter(Boolean).join(' / ') || null;
    description = item.content || null; id = item.id ?? item.internal_job_id ?? null; opening = item.updated_at || null; url = item.absolute_url || url;
  } else if (provider === 'lever') {
    title = item.text; organization = source.organization || null; location = item.categories?.location || item.workplaceType || null;
    description = item.descriptionPlain || item.description || null; id = item.id || null; opening = item.createdAt ? new Date(item.createdAt).toISOString() : null;
    url = item.hostedUrl || item.applyUrl || url; employmentType = item.categories?.commitment || '';
  } else if (provider === 'ashby') {
    title = item.title; organization = source.organization || null; location = item.location || item.secondaryLocations?.map((x) => x.location).filter(Boolean).join(' / ') || null;
    description = item.descriptionPlain || item.descriptionHtml || null; id = item.jobUrl || item.applyUrl || null; opening = item.publishedAt || null; url = item.jobUrl || item.applyUrl || url; employmentType = item.employmentType || '';
  } else if (provider === 'smartrecruiters') {
    title = item.name || item.title; organization = source.organization || null;
    location = [item.location?.city, item.location?.region, item.location?.country].filter(Boolean).join(', ') || null;
    id = item.refNumber || item.id || null; opening = item.releasedDate || null; url = item.ref || item.applyUrl || url;
    description = item.jobAd?.sections?.map((x) => `${x.title || ''} ${x.text || ''}`).join('\n') || null;
  }
  title = cleanText(title, 300);
  description = cleanText(description, 5000);
  if (!title) return null;
  const inferredType = normalizeOpportunityType(`${sourceType} ${employmentType}`, title, description || '', url || '');
  return {
    title, organization: organization || null, opportunity_type: inferredType,
    location: flattenLocation(location), advertisement_number: id ? String(id).slice(0, 150) : null,
    application_opening: normalizeDate(opening), application_deadline: normalizeDate(deadline, { endOfDay: true }),
    vacancies_total: null, description, requirements: [], career_ids: [],
    source_url: url, source_document_url: url, status: 'open', source_type: sourceType
  };
}

export function canonicalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = '';
    const trackingRegex = /^(utm_|ref$|source$|tracking|fbclid|gclid|timestamp$|cache_bust$|_t$|t$|session$)/i;
    for (const key of [...parsed.searchParams.keys()]) {
      if (trackingRegex.test(key)) parsed.searchParams.delete(key);
    }
    let pathname = parsed.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '/';
    parsed.pathname = pathname.toLowerCase();
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

export { normalizeOpportunityType };
