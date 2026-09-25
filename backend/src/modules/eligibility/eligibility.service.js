import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';

import { evaluateRequirement } from './eligibility.engine.js';

export async function getProfileForEligibility(userId) {
  const result = await pool.query(
    `SELECT up.education, up.experience, up.preferred_locations,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('name', s.name, 'level', us.level, 'years_experience', us.years_experience))
         FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = up.user_id), '[]'::jsonb) AS skills
     FROM user_profiles up WHERE up.user_id = $1`, [userId]
  );
  return result.rows[0] ?? null;
}

export async function checkEligibility(userId, opportunityId) {
  const profile = await getProfileForEligibility(userId);
  if (!profile) { const error = new Error('Profile not found.'); error.statusCode = 404; error.code = 'PROFILE_NOT_FOUND'; throw error; }
  const opportunity = await pool.query(
    `SELECT id, title, organization, status, record_status FROM opportunities WHERE id = $1 AND record_status = 'published'`, [opportunityId]
  );
  if (!opportunity.rows[0]) { const error = new Error('Opportunity not found.'); error.statusCode = 404; error.code = 'OPPORTUNITY_NOT_FOUND'; throw error; }
  const requirements = await pool.query(
    `SELECT id, requirement_type, requirement_text, rule_data, verification_status, source_url, source_document_url
     FROM opportunity_requirements WHERE opportunity_id = $1 ORDER BY created_at, id`, [opportunityId]
  );
  const results = requirements.rows.map((requirement) => ({
    requirement_id: requirement.id,
    requirement_type: requirement.requirement_type,
    requirement_text: requirement.requirement_text,
    ...evaluateRequirement(requirement, profile),
    source_url: requirement.source_url,
    source_document_url: requirement.source_document_url
  }));
  const outcome = results.length === 0 || results.some((item) => item.status === 'unable_to_determine')
    ? (results.some((item) => item.status === 'not_satisfied') ? 'does_not_meet_listed_requirements' : 'unable_to_determine')
    : results.some((item) => item.status === 'not_satisfied') ? 'does_not_meet_listed_requirements' : 'meets_listed_requirements';
  const saved = await pool.query(
    `INSERT INTO eligibility_checks (user_id, opportunity_id, outcome, results) VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, opportunity_id, outcome, results, evaluated_at`, [userId, opportunityId, outcome, JSON.stringify(results)]
  );
  return { ...saved.rows[0], opportunity: opportunity.rows[0] };
}

export async function getEligibilityCheck(userId, checkId) {
  const result = await pool.query(
    `SELECT ec.id, ec.opportunity_id, ec.outcome, ec.results, ec.evaluated_at,
            o.title AS opportunity_title, o.organization
     FROM eligibility_checks ec JOIN opportunities o ON o.id = ec.opportunity_id
     WHERE ec.id = $1 AND ec.user_id = $2`, [checkId, userId]
  );
  return result.rows[0] ?? null;
}

export async function listRequirements(opportunityId) {
  const opportunity = await pool.query(`SELECT id, title, organization FROM opportunities WHERE id = $1 AND record_status = 'published'`, [opportunityId]);
  if (!opportunity.rows[0]) return null;
  const requirements = await pool.query(
    `SELECT id, requirement_type, requirement_text, rule_data, verification_status, source_id, source_url, source_document_url, created_at, updated_at
     FROM opportunity_requirements WHERE opportunity_id = $1 ORDER BY created_at, id`, [opportunityId]
  );
  return { opportunity: opportunity.rows[0], requirements: requirements.rows };
}

export async function addRequirement(actor, opportunityId, input) {
  const opportunity = await pool.query(`SELECT id FROM opportunities WHERE id = $1`, [opportunityId]);
  if (!opportunity.rows[0]) { const error = new Error('Opportunity not found.'); error.statusCode = 404; error.code = 'OPPORTUNITY_NOT_FOUND'; throw error; }
  const result = await pool.query(
    `INSERT INTO opportunity_requirements
      (opportunity_id, requirement_type, requirement_text, rule_data, verification_status, source_id, source_url, source_document_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, opportunity_id, requirement_type, requirement_text, rule_data, verification_status, source_id, source_url, source_document_url, created_at`,
    [opportunityId, input.requirement_type, input.requirement_text, JSON.stringify(input.rule_data), input.verification_status, input.source_id ?? null, input.source_url ?? null, input.source_document_url ?? null]
  );
  await pool.query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after_data, metadata)
     VALUES ($1, 'create', 'opportunity_requirement', $2, $3, $4)`,
    [actor.id, result.rows[0].id, JSON.stringify(result.rows[0]), JSON.stringify({ role: actor.role })]
  );
  return result.rows[0];
}

export async function explainEligibilityWithAi(check) {
  if (!env.AI_SERVICE_URL) return null;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = { 'content-type': 'application/json' };
    if (env.INTERNAL_SERVICE_TOKEN) headers['x-internal-service-token'] = env.INTERNAL_SERVICE_TOKEN;
    const response = await fetch(`${env.AI_SERVICE_URL}/internal/v1/eligibility/explain`, { method: 'POST', headers, body: JSON.stringify({ outcome: check.outcome, results: check.results }), signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
  finally { clearTimeout(timeout); }
}
