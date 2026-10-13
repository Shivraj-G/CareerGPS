import { pool } from '../../config/database.js';

function decodeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export async function listOpportunities(input) {
  const {
    search = '',
    status = '',
    opportunity_type = '',
    location = '',
    career_id = '',
    page = 1,
    limit = 20
  } = input;

  const numPage = Math.max(1, Number(page) || 1);
  const numLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const offset = (numPage - 1) * numLimit;

  const conditions = ["o.record_status = 'published'"];
  const values = [];

  // 1. Search filter: search title, organization, description, category, source name, advertisement number
  const cleanSearch = String(search || '').trim();
  if (cleanSearch) {
    values.push(cleanSearch);
    const p = `$${values.length}`;
    conditions.push(`(
      o.title ILIKE '%' || ${p} || '%'
      OR o.organization ILIKE '%' || ${p} || '%'
      OR o.description ILIKE '%' || ${p} || '%'
      OR o.opportunity_type ILIKE '%' || ${p} || '%'
      OR s.name ILIKE '%' || ${p} || '%'
      OR o.advertisement_number ILIKE '%' || ${p} || '%'
    )`);
  }

  // 2. Status filter
  const cleanStatus = String(status || '').trim().toLowerCase().replace(/[- ]+/g, '_');
  if (cleanStatus && cleanStatus !== 'all') {
    if (cleanStatus === 'open') {
      conditions.push(`((o.status = 'open' OR o.status = 'unknown') AND (o.application_deadline IS NULL OR o.application_deadline >= NOW()))`);
    } else if (cleanStatus === 'closing_soon') {
      conditions.push(`((o.status = 'open' OR o.status = 'unknown') AND o.application_deadline IS NOT NULL AND o.application_deadline >= NOW() AND o.application_deadline <= (NOW() + INTERVAL '30 days'))`);
    } else if (cleanStatus === 'closed') {
      conditions.push(`(o.status = 'closed' OR (o.application_deadline IS NOT NULL AND o.application_deadline < NOW()))`);
    } else if (cleanStatus === 'expired') {
      conditions.push(`(o.application_deadline IS NOT NULL AND o.application_deadline < NOW())`);
    } else if (cleanStatus === 'upcoming') {
      conditions.push(`(o.status = 'upcoming' OR (o.application_opening IS NOT NULL AND o.application_opening > NOW()))`);
    } else {
      values.push(cleanStatus);
      const p = `$${values.length}`;
      conditions.push(`o.status = ${p}`);
    }
  }

  // 3. Opportunity Type filter
  const cleanType = String(opportunity_type || '').trim().toLowerCase().replace(/[- ]+/g, '_');
  if (cleanType && cleanType !== 'all') {
    if (cleanType === 'government' || cleanType === 'government_recruitment') {
      conditions.push(`o.opportunity_type = 'government_recruitment'`);
    } else if (cleanType === 'private' || cleanType === 'private_job' || cleanType === 'private_sector') {
      conditions.push(`o.opportunity_type IN ('private_job', 'private_careers')`);
    } else if (cleanType === 'internship') {
      conditions.push(`o.opportunity_type = 'internship'`);
    } else if (cleanType === 'apprenticeship') {
      conditions.push(`o.opportunity_type = 'apprenticeship'`);
    } else if (cleanType === 'scholarship') {
      conditions.push(`o.opportunity_type = 'scholarship'`);
    } else if (cleanType === 'programme' || cleanType === 'graduate_programme') {
      conditions.push(`o.opportunity_type IN ('graduate_programme', 'programme')`);
    } else {
      values.push(cleanType);
      const p = `$${values.length}`;
      conditions.push(`REPLACE(REPLACE(o.opportunity_type, '_', ' '), '-', ' ') ILIKE '%' || REPLACE(REPLACE(${p}, '_', ' '), '-', ' ') || '%'`);
    }
  }

  // 4. Location filter
  const cleanLocation = String(location || '').trim();
  if (cleanLocation && cleanLocation.toLowerCase() !== 'all') {
    values.push(cleanLocation);
    const p = `$${values.length}`;
    conditions.push(`o.location ILIKE '%' || ${p} || '%'`);
  }

  // 5. Career ID filter
  const cleanCareerId = String(career_id || '').trim();
  if (cleanCareerId) {
    values.push(cleanCareerId);
    const p = `$${values.length}`;
    conditions.push(`EXISTS (SELECT 1 FROM career_opportunities co_filter WHERE co_filter.opportunity_id = o.id AND co_filter.career_id = ${p}::uuid)`);
  }

  const whereClause = `WHERE ` + conditions.join(' AND ');

  const countQuery = `
    SELECT COUNT(DISTINCT o.id)::int AS total
    FROM opportunities o
    LEFT JOIN sources s ON s.id = o.source_id
    ${whereClause}
  `;
  const countResult = await pool.query(countQuery, values);
  const total = countResult.rows[0]?.total ?? 0;

  const limitParamIndex = values.length + 1;
  const offsetParamIndex = values.length + 2;
  const dataValues = [...values, numLimit, offset];

  const dataQuery = `
    SELECT o.id, o.title, o.organization, o.opportunity_type, o.location,
           o.advertisement_number, o.application_opening, o.application_deadline,
           o.vacancies_total, o.description, o.status, o.verification_status,
           o.source_id, o.source_url, o.source_document_url, o.source_last_checked_at, o.verified_at,
           o.created_at, o.updated_at, o.dedup_key,
           s.name AS source_name, s.source_type AS source_type
    FROM opportunities o
    LEFT JOIN sources s ON s.id = o.source_id
    ${whereClause}
    ORDER BY CASE o.status WHEN 'open' THEN 1 WHEN 'upcoming' THEN 2 WHEN 'unknown' THEN 3 WHEN 'closed' THEN 4 ELSE 5 END,
             o.application_deadline NULLS LAST, o.created_at DESC, o.title ASC
    LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;
  const dataResult = await pool.query(dataQuery, dataValues);

  // Facets query for supported types in published records
  const facetsResult = await pool.query(`
    SELECT DISTINCT opportunity_type FROM opportunities WHERE record_status = 'published' AND opportunity_type IS NOT NULL
  `);
  const supportedTypes = facetsResult.rows.map(r => r.opportunity_type);

  return {
    data: dataResult.rows.map(row => ({
      ...row,
      title: decodeHtml(row.title),
      description: decodeHtml(row.description),
    })),
    pagination: {
      page: numPage,
      limit: numLimit,
      total,
      total_pages: Math.max(1, Math.ceil(total / numLimit))
    },
    facets: {
      supported_types: supportedTypes,
      supported_statuses: ['open', 'closing_soon', 'closed'],
      supported_locations: ['Goa', 'Bengaluru', 'Remote']
    }
  };
}

export async function getOpportunity(opportunityId) {
  const result = await pool.query(
    `SELECT o.id, o.title, o.organization, o.opportunity_type, o.location,
            o.advertisement_number, o.application_opening, o.application_deadline,
            o.vacancies_total, o.description, o.status, o.verification_status,
            o.source_id, o.source_url, o.source_document_url, o.source_last_checked_at, o.verified_at,
            o.created_at, o.updated_at,
            s.name AS source_name, s.source_type AS source_type,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'id', r.id, 'requirement_type', r.requirement_type,
              'requirement_text', r.requirement_text, 'rule_data', r.rule_data,
              'verification_status', r.verification_status, 'source_url', r.source_url,
              'source_document_url', r.source_document_url
            ) ORDER BY r.created_at, r.id)
            FROM opportunity_requirements r WHERE r.opportunity_id = o.id), '[]'::jsonb) AS requirements,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'career_id', c.id, 'title', c.title, 'relation_type', co.relation_type
            ) ORDER BY c.title)
            FROM career_opportunities co JOIN careers c ON c.id = co.career_id
            WHERE co.opportunity_id = o.id AND c.record_status = 'published'), '[]'::jsonb) AS related_careers
     FROM opportunities o
     LEFT JOIN sources s ON s.id = o.source_id
     WHERE o.id = $1 AND o.record_status = 'published'`, [opportunityId]
  );
  if (!result.rows[0]) return null;

  const row = result.rows[0];
  const cleanedRequirements = Array.isArray(row.requirements)
    ? row.requirements.map(req => ({
        ...req,
        requirement_text: decodeHtml(req.requirement_text)
      }))
    : [];

  return {
    ...row,
    title: decodeHtml(row.title),
    description: decodeHtml(row.description),
    requirements: cleanedRequirements
  };
}
