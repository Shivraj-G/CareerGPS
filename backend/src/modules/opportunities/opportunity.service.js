import { pool } from '../../config/database.js';

export async function listOpportunities(input) {
  const { search = '', status = '', opportunity_type = '', location = '', career_id = '', page, limit } = input;
  const offset = (page - 1) * limit;
  const values = [search, status, opportunity_type, location, career_id];
  const where = `WHERE o.record_status = 'published'
    AND ($1 = '' OR o.title ILIKE '%' || $1 || '%' OR o.organization ILIKE '%' || $1 || '%' OR o.description ILIKE '%' || $1 || '%')
    AND ($2 = '' OR o.status = $2)
    AND ($3 = '' OR o.opportunity_type ILIKE '%' || $3 || '%')
    AND ($4 = '' OR o.location ILIKE '%' || $4 || '%')
    AND ($5 = '' OR EXISTS (SELECT 1 FROM career_opportunities co_filter WHERE co_filter.opportunity_id = o.id AND co_filter.career_id = $5))`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM opportunities o ${where}`, values);
  values.push(limit, offset);
  const result = await pool.query(
    `SELECT o.id, o.title, o.organization, o.opportunity_type, o.location,
            o.advertisement_number, o.application_opening, o.application_deadline,
            o.vacancies_total, o.description, o.status, o.verification_status,
            o.source_url, o.source_document_url, o.source_last_checked_at, o.verified_at
     FROM opportunities o ${where}
     ORDER BY CASE o.status WHEN 'open' THEN 1 WHEN 'upcoming' THEN 2 WHEN 'unknown' THEN 3 WHEN 'closed' THEN 4 ELSE 5 END,
              o.application_deadline NULLS LAST, o.title ASC
     LIMIT $6 OFFSET $7`, values
  );
  const total = count.rows[0].total;
  return { data: result.rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } };
}

export async function getOpportunity(opportunityId) {
  const result = await pool.query(
    `SELECT o.id, o.title, o.organization, o.opportunity_type, o.location,
            o.advertisement_number, o.application_opening, o.application_deadline,
            o.vacancies_total, o.description, o.status, o.verification_status,
            o.source_url, o.source_document_url, o.source_last_checked_at, o.verified_at,
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
     WHERE o.id = $1 AND o.record_status = 'published'`, [opportunityId]
  );
  return result.rows[0] ?? null;
}
