export function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function stripHtml(html) {
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

export function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
  return html.match(re)?.[1]?.trim() || null;
}

export function titleFromHtml(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null;
}

export function extractOpportunity(html, finalUrl) {
  const text = stripHtml(html);
  const title = meta(html, 'og:title') || titleFromHtml(html);
  const deadlineMatch = text.match(/(?:last date|application deadline|closing date|deadline)\s*[:\-]?\s*([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i);
  const advertisementMatch = text.match(/(?:advertisement|advt\.?|notification)\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9\/-]{3,})/i);
  const location = /\bgoa\b/i.test(text) ? 'Goa' : null;

  // NOTE: extraction_status is NOT included here. The confirmed ingestion-candidate
  // contract puts extraction_status as a sibling of candidate_data (inside "candidate"),
  // not inside candidate_data itself — see worker.js's submission body.
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
    opportunity_type: 'government'
  };
}
