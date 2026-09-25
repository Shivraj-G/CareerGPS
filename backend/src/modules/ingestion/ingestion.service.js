import { pool } from '../../config/database.js';

function conflict(message, code = 'CONFLICT') {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = code;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  return error;
}

function badRequest(message, details) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  if (details) error.details = details;
  return error;
}

function cleanCandidateData(data) {
  const value = { ...data };
  value.title = typeof value.title === 'string' ? value.title.trim() : value.title;
  value.organization = typeof value.organization === 'string' ? value.organization.trim() : value.organization;
  value.source_url = typeof value.source_url === 'string' ? value.source_url.trim() : value.source_url;
  value.status = typeof value.status === 'string' ? value.status.trim().toLowerCase() : value.status;
  value.opportunity_type = typeof value.opportunity_type === 'string' ? value.opportunity_type.trim() : value.opportunity_type;
  value.location = typeof value.location === 'string' ? value.location.trim() : value.location;
  value.requirements = Array.isArray(value.requirements) ? value.requirements : [];
  value.career_ids = Array.isArray(value.career_ids) ? value.career_ids : [];
  return value;
}

function validateOpportunityCandidate(data) {
  const errors = [];
  const value = cleanCandidateData(data);
  if (!value.title) errors.push({ field: 'title', message: 'Title is required.' });
  if (!value.organization) errors.push({ field: 'organization', message: 'Organization is required.' });
  if (!value.source_url) errors.push({ field: 'source_url', message: 'source_url is required.' });
  if (value.status && !['upcoming', 'open', 'closed', 'cancelled', 'unknown'].includes(value.status)) {
    errors.push({ field: 'status', message: 'Invalid opportunity status.' });
  }
  if (!Array.isArray(value.requirements)) errors.push({ field: 'requirements', message: 'requirements must be an array.' });
  for (const [index, requirement] of value.requirements.entries()) {
    if (!requirement || typeof requirement !== 'object') {
      errors.push({ field: `requirements.${index}`, message: 'Requirement must be an object.' });
      continue;
    }
    if (!requirement.requirement_type || !requirement.requirement_text) {
      errors.push({ field: `requirements.${index}`, message: 'Requirement type and text are required.' });
    }
  }
  return { errors, data: value };
}

async function writeAudit(client, { actorUserId, action, entityType, entityId, beforeData = null, afterData = null, metadata = {} }) {
  await client.query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, before_data, after_data, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
    [actorUserId ?? null, action, entityType ?? null, entityId ?? null,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      JSON.stringify(metadata)]
  );
}

export async function listSources() {
  const result = await pool.query(
    `SELECT id, name, source_type, base_url, organization, is_approved, access_notes,
            last_checked_at, created_at, updated_at
     FROM sources ORDER BY is_approved DESC, name ASC`
  );
  return result.rows;
}

export async function createSource(actor, input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO sources (name, source_type, base_url, organization, is_approved, access_notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.name, input.source_type, input.base_url, input.organization ?? null, input.is_approved ?? false, input.access_notes ?? null]
    );
    const source = result.rows[0];
    await writeAudit(client, {
      actorUserId: actor.id,
      action: 'SOURCE_CREATED',
      entityType: 'source',
      entityId: source.id,
      afterData: source
    });
    await client.query('COMMIT');
    return source;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw conflict('A source with these details already exists.');
    throw error;
  } finally { client.release(); }
}

export async function updateSource(actor, sourceId, input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT * FROM sources WHERE id = $1 FOR UPDATE', [sourceId]);
    if (!current.rowCount) throw notFound('Source not found.');
    const before = current.rows[0];
    const fields = Object.keys(input);
    const values = fields.map((field) => input[field]);
    const setSql = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    values.push(sourceId);
    const result = await client.query(`UPDATE sources SET ${setSql} WHERE id = $${values.length} RETURNING *`, values);
    const source = result.rows[0];
    await writeAudit(client, {
      actorUserId: actor.id,
      action: 'SOURCE_UPDATED',
      entityType: 'source',
      entityId: sourceId,
      beforeData: before,
      afterData: source
    });
    await client.query('COMMIT');
    return source;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function createRun(actor, sourceId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const source = await client.query('SELECT * FROM sources WHERE id = $1 FOR UPDATE', [sourceId]);
    if (!source.rowCount) throw notFound('Source not found.');
    if (!source.rows[0].is_approved) throw conflict('The source is not approved for ingestion.', 'SOURCE_NOT_APPROVED');

    const active = await client.query(
      `SELECT id FROM ingestion_runs WHERE source_id = $1 AND status IN ('started', 'running') LIMIT 1`,
      [sourceId]
    );
    if (active.rowCount) throw conflict('An ingestion run is already active for this source.', 'INGESTION_RUN_ACTIVE');

    const result = await client.query(
      `INSERT INTO ingestion_runs (source_id, status) VALUES ($1, 'started') RETURNING *`,
      [sourceId]
    );
    const run = result.rows[0];
    await writeAudit(client, {
      actorUserId: actor.id,
      action: 'INGESTION_RUN_CREATED',
      entityType: 'ingestion_run',
      entityId: run.id,
      afterData: run,
      metadata: { source_id: sourceId }
    });
    await client.query('COMMIT');
    return run;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function listRuns({ sourceId } = {}) {
  const values = [];
  const where = sourceId ? 'WHERE r.source_id = $1' : '';
  if (sourceId) values.push(sourceId);
  const result = await pool.query(
    `SELECT r.*, s.name AS source_name, s.base_url AS source_base_url
     FROM ingestion_runs r LEFT JOIN sources s ON s.id = r.source_id
     ${where} ORDER BY r.started_at DESC`, values
  );
  return result.rows;
}

export async function getRun(runId) {
  const result = await pool.query(
    `SELECT r.*, s.name AS source_name, s.base_url AS source_base_url,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'entity_type', c.entity_type, 'review_status', c.review_status,
        'extraction_status', c.extraction_status, 'created_at', c.created_at,
        'reviewed_at', c.reviewed_at
      ) ORDER BY c.created_at DESC) FROM ingestion_candidates c WHERE c.run_id = r.id), '[]'::jsonb) AS candidates
     FROM ingestion_runs r LEFT JOIN sources s ON s.id = r.source_id
     WHERE r.id = $1`, [runId]
  );
  if (!result.rowCount) throw notFound('Ingestion run not found.');
  return result.rows[0];
}

export async function submitCandidate(input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runResult = await client.query(
      `SELECT r.*, s.is_approved, s.organization AS source_organization
       FROM ingestion_runs r
       JOIN sources s ON s.id = r.source_id
       WHERE r.id = $1 FOR UPDATE`, [input.run_id]
    );
    if (!runResult.rowCount) throw notFound('Ingestion run not found.');
    const run = runResult.rows[0];
    if (run.source_id !== input.source_id) throw badRequest('run_id and source_id do not match.');
    if (!run.is_approved) throw conflict('The source is not approved for ingestion.', 'SOURCE_NOT_APPROVED');
    if (!['started', 'running'].includes(run.status)) throw conflict('The ingestion run is not active.', 'INGESTION_RUN_NOT_ACTIVE');

    const documentResult = await client.query(
      `INSERT INTO source_documents
       (source_id, url, document_title, content_hash, fetched_at, published_at, raw_text, extraction_version)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6::timestamptz, $7, $8)
       ON CONFLICT (source_id, url, content_hash) DO UPDATE SET
         document_title = EXCLUDED.document_title,
         fetched_at = EXCLUDED.fetched_at,
         published_at = EXCLUDED.published_at,
         raw_text = EXCLUDED.raw_text,
         extraction_version = EXCLUDED.extraction_version,
         updated_at = NOW()
       RETURNING *`,
      [input.source_id, input.document.url, input.document.document_title ?? null,
        input.document.content_hash, input.document.fetched_at ?? null, input.document.published_at ?? null,
        input.document.raw_text ?? null, input.document.extraction_version ?? input.candidate.extraction_version ?? 'phase8-v1']
    );
    const document = documentResult.rows[0];

    const candidateData = cleanCandidateData(input.candidate.candidate_data);
    if (!candidateData.organization && run.source_organization) {
      candidateData.organization = run.source_organization;
    }
    const candidateCheck = validateOpportunityCandidate(candidateData);
    const extractionStatus = candidateCheck.errors.length ? 'needs_review' : input.candidate.extraction_status;
    const reviewNotes = candidateCheck.errors.length ? JSON.stringify(candidateCheck.errors) : null;

    const candidateResult = await client.query(
      `INSERT INTO ingestion_candidates
       (run_id, entity_type, candidate_data, source_document_id, extraction_version, extraction_status, review_status, review_notes)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, 'needs_review', $7)
       RETURNING *`,
      [input.run_id, input.candidate.entity_type, JSON.stringify(candidateCheck.data), document.id,
        input.candidate.extraction_version ?? 'phase8-v1', extractionStatus, reviewNotes]
    );

    await client.query(
      `UPDATE ingestion_runs
       SET status = 'running', discovered_count = discovered_count + 1,
           extracted_count = extracted_count + 1,
           updated_at = NOW()
       WHERE id = $1`, [input.run_id]
    );
    await client.query('COMMIT');
    return candidateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function updateRunStatus(runId, input) {
  const result = await pool.query(
    `UPDATE ingestion_runs
     SET status = $2::varchar,
         discovered_count = COALESCE($3, discovered_count),
         extracted_count = COALESCE($4, extracted_count),
         accepted_count = COALESCE($5, accepted_count),
         rejected_count = COALESCE($6, rejected_count),
         error_message = $7::text,
         completed_at = CASE WHEN $2::varchar IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
         updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [runId, input.status, input.discovered_count ?? null, input.extracted_count ?? null,
      input.accepted_count ?? null, input.rejected_count ?? null, input.error_message ?? null]
  );
  if (!result.rowCount) throw notFound('Ingestion run not found.');
  return result.rows[0];
}

export async function listReviewQueue({ status = 'needs_review', entityType, page, limit }) {
  const values = [status, entityType ?? ''];
  const where = `WHERE c.review_status = $1 AND ($2 = '' OR c.entity_type = $2)`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM ingestion_candidates c ${where}`, values);
  values.push(limit, (page - 1) * limit);
  const result = await pool.query(
    `SELECT c.id, c.run_id, c.entity_type, c.candidate_data, c.extraction_status,
            c.review_status, c.review_notes, c.reviewer_user_id, c.reviewed_at,
            c.created_at, c.updated_at, r.source_id, s.name AS source_name,
            s.base_url AS source_base_url, d.url AS source_document_url,
            d.document_title, d.content_hash, d.fetched_at
     FROM ingestion_candidates c
     JOIN ingestion_runs r ON r.id = c.run_id
     LEFT JOIN sources s ON s.id = r.source_id
     LEFT JOIN source_documents d ON d.id = c.source_document_id
     ${where}
     ORDER BY c.created_at DESC LIMIT $3 OFFSET $4`, values
  );
  const total = count.rows[0].total;
  return { data: result.rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } };
}

export async function getCandidate(candidateId) {
  const result = await pool.query(
    `SELECT c.*, r.source_id, r.status AS run_status, s.name AS source_name,
            s.base_url AS source_base_url, s.is_approved,
            d.url AS document_url, d.document_title, d.content_hash, d.fetched_at,
            d.published_at, d.raw_text, d.extraction_version AS document_extraction_version
     FROM ingestion_candidates c
     JOIN ingestion_runs r ON r.id = c.run_id
     LEFT JOIN sources s ON s.id = r.source_id
     LEFT JOIN source_documents d ON d.id = c.source_document_id
     WHERE c.id = $1`, [candidateId]
  );
  if (!result.rowCount) throw notFound('Ingestion candidate not found.');
  return result.rows[0];
}

async function findDuplicateOpportunity(client, data) {
  if (data.advertisement_number) {
    const result = await client.query(
      `SELECT id, title, organization, record_status FROM opportunities
       WHERE organization = $1 AND advertisement_number = $2 LIMIT 1`,
      [data.organization, data.advertisement_number]
    );
    if (result.rowCount) return result.rows[0];
  }
  if (data.source_url) {
    const result = await client.query(
      `SELECT id, title, organization, record_status FROM opportunities
       WHERE source_url = $1 LIMIT 1`, [data.source_url]
    );
    if (result.rowCount) return result.rows[0];
  }
  return null;
}

async function publishApprovedCandidate(client, candidate, actorUserId) {
  const validation = validateOpportunityCandidate(candidate.candidate_data);
  if (validation.errors.length) throw badRequest('Candidate cannot be published until required fields are valid.', validation.errors);
  if (!candidate.is_approved) throw conflict('Candidate source is not approved.', 'SOURCE_NOT_APPROVED');
  if (!['approved'].includes(candidate.review_status)) throw conflict('Candidate must be approved by a reviewer before publishing.', 'CANDIDATE_NOT_APPROVED');

  const data = validation.data;
  const duplicate = await findDuplicateOpportunity(client, data);
  if (duplicate) throw conflict(`A matching opportunity already exists (${duplicate.id}).`, 'DUPLICATE_OPPORTUNITY');

  const result = await client.query(
    `INSERT INTO opportunities
     (title, organization, opportunity_type, location, advertisement_number,
      application_opening, application_deadline, vacancies_total, description, status,
      record_status, verification_status, source_id, source_url, source_document_url,
      source_last_checked_at, verified_at)
     VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8,$9,$10,'published','verified',$11,$12,$13,NOW(),NOW())
     RETURNING *`,
    [data.title, data.organization, data.opportunity_type ?? null, data.location ?? null,
      data.advertisement_number ?? null, data.application_opening ?? null, data.application_deadline ?? null,
      data.vacancies_total ?? null, data.description ?? null, data.status ?? 'unknown',
      candidate.source_id, data.source_url, data.source_document_url ?? candidate.document_url ?? null]
  );
  const opportunity = result.rows[0];

  for (const requirement of data.requirements ?? []) {
    await client.query(
      `INSERT INTO opportunity_requirements
       (opportunity_id, requirement_type, requirement_text, rule_data, verification_status, source_id, source_url, source_document_url)
       VALUES ($1,$2,$3,$4::jsonb,'verified',$5,$6,$7)`,
      [opportunity.id, requirement.requirement_type, requirement.requirement_text,
        JSON.stringify(requirement.rule_data ?? {}), candidate.source_id,
        requirement.source_url ?? data.source_url, requirement.source_document_url ?? candidate.document_url ?? null]
    );
  }

  const careerIds = [...new Set((data.career_ids ?? []).filter(Boolean))];
  for (const careerId of careerIds) {
    const career = await client.query(`SELECT id FROM careers WHERE id = $1 AND record_status = 'published'`, [careerId]);
    if (career.rowCount) {
      await client.query(
        `INSERT INTO career_opportunities (career_id, opportunity_id, relation_type)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [careerId, opportunity.id, data.career_relation_type ?? 'related']
      );
    }
  }

  const evidenceFields = ['title', 'organization', 'location', 'advertisement_number', 'application_opening', 'application_deadline', 'vacancies_total', 'description', 'status'];
  for (const field of evidenceFields) {
    if (data[field] !== undefined && data[field] !== null && candidate.source_document_id) {
      await client.query(
        `INSERT INTO source_evidence
         (source_document_id, entity_type, entity_id, field_name, evidence_text, extraction_version, review_status, reviewer_user_id, reviewed_at)
         VALUES ($1,'opportunity',$2,$3,$4,$5,'approved',$6,NOW())`,
        [candidate.source_document_id, opportunity.id, field, String(data[field]), candidate.extraction_version ?? 'phase8-v1', actorUserId]
      );
    }
  }

  await client.query(
    `UPDATE ingestion_candidates
     SET extraction_status = 'published', review_status = 'approved', reviewer_user_id = $2,
         reviewed_at = COALESCE(reviewed_at, NOW()), updated_at = NOW()
     WHERE id = $1`, [candidate.id, actorUserId]
  );
  await client.query(
    `UPDATE ingestion_runs SET accepted_count = accepted_count + 1, updated_at = NOW() WHERE id = $1`, [candidate.run_id]
  );

  await writeAudit(client, {
    actorUserId,
    action: 'INGESTION_CANDIDATE_PUBLISHED',
    entityType: 'opportunity',
    entityId: opportunity.id,
    afterData: opportunity,
    metadata: { candidate_id: candidate.id, run_id: candidate.run_id, source_id: candidate.source_id }
  });
  return opportunity;
}

export async function reviewCandidate(actor, candidateId, action, reviewNotes) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT c.*, r.source_id, s.is_approved, d.url AS document_url
       FROM ingestion_candidates c
       JOIN ingestion_runs r ON r.id = c.run_id
       JOIN sources s ON s.id = r.source_id
       LEFT JOIN source_documents d ON d.id = c.source_document_id
       WHERE c.id = $1 FOR UPDATE OF c, r, s`, [candidateId]
    );
    if (!result.rowCount) throw notFound('Ingestion candidate not found.');
    const candidate = result.rows[0];
    if (candidate.review_status === 'rejected' || candidate.extraction_status === 'published') {
      throw conflict('This candidate has already been finalized.', 'CANDIDATE_FINALIZED');
    }

    if (action === 'request-review') {
      await client.query(
        `UPDATE ingestion_candidates SET review_status = 'request_review', reviewer_user_id = $2,
          reviewed_at = NOW(), review_notes = $3, updated_at = NOW() WHERE id = $1`,
        [candidateId, actor.id, reviewNotes ?? null]
      );
      await writeAudit(client, {
        actorUserId: actor.id, action: 'INGESTION_CANDIDATE_REVIEW_REQUESTED', entityType: 'ingestion_candidate', entityId: candidateId,
        beforeData: candidate, metadata: { run_id: candidate.run_id }
      });
      await client.query('COMMIT');
      return getCandidate(candidateId);
    }

    if (action === 'reject') {
      await client.query(
        `UPDATE ingestion_candidates SET review_status = 'rejected', extraction_status = 'rejected',
          reviewer_user_id = $2, reviewed_at = NOW(), review_notes = $3, updated_at = NOW() WHERE id = $1`,
        [candidateId, actor.id, reviewNotes ?? null]
      );
      await client.query(`UPDATE ingestion_runs SET rejected_count = rejected_count + 1, updated_at = NOW() WHERE id = $1`, [candidate.run_id]);
      await writeAudit(client, {
        actorUserId: actor.id, action: 'INGESTION_CANDIDATE_REJECTED', entityType: 'ingestion_candidate', entityId: candidateId,
        beforeData: candidate, metadata: { run_id: candidate.run_id, review_notes: reviewNotes ?? null }
      });
      await client.query('COMMIT');
      return getCandidate(candidateId);
    }

    if (action === 'approve') {
      const candidateData = validateOpportunityCandidate(candidate.candidate_data);
      if (candidateData.errors.length) throw badRequest('Candidate needs correction before approval.', candidateData.errors);
      if (!candidate.is_approved) throw conflict('The source is not approved.', 'SOURCE_NOT_APPROVED');
      if (candidate.review_status !== 'needs_review' && candidate.review_status !== 'request_review') {
        throw conflict('Candidate is not awaiting review.', 'CANDIDATE_NOT_AWAITING_REVIEW');
      }

      await client.query(
        `UPDATE ingestion_candidates SET review_status = 'approved', extraction_status = 'approved',
          reviewer_user_id = $2, reviewed_at = NOW(), review_notes = $3, updated_at = NOW() WHERE id = $1`,
        [candidateId, actor.id, reviewNotes ?? null]
      );
      candidate.review_status = 'approved';
      candidate.extraction_status = 'approved';
      candidate.reviewer_user_id = actor.id;
      const opportunity = await publishApprovedCandidate(client, candidate, actor.id);
      await client.query('COMMIT');
      return opportunity;
    }

    throw badRequest('Unsupported review action.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function publishInternal(candidateId, serviceMetadata = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT c.*, r.source_id, s.is_approved, d.url AS document_url
       FROM ingestion_candidates c
       JOIN ingestion_runs r ON r.id = c.run_id
       JOIN sources s ON s.id = r.source_id
       LEFT JOIN source_documents d ON d.id = c.source_document_id
       WHERE c.id = $1 FOR UPDATE OF c, r, s`, [candidateId]
    );
    if (!result.rowCount) throw notFound('Ingestion candidate not found.');
    const candidate = result.rows[0];
    if (candidate.review_status !== 'approved') throw conflict('Candidate must be reviewer-approved before publishing.', 'CANDIDATE_NOT_APPROVED');
    const opportunity = await publishApprovedCandidate(client, candidate, null);
    await writeAudit(client, {
      actorUserId: null, action: 'INTERNAL_PUBLISH_REQUEST', entityType: 'ingestion_candidate', entityId: candidateId,
      metadata: serviceMetadata
    });
    await client.query('COMMIT');
    return opportunity;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function listAuditLogs({ entityType, action, page, limit }) {
  const values = [entityType ?? '', action ?? ''];
  const where = `WHERE ($1 = '' OR entity_type = $1) AND ($2 = '' OR action = $2)`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM audit_logs ${where}`, values);
  values.push(limit, (page - 1) * limit);
  const result = await pool.query(
    `SELECT a.*, u.email AS actor_email
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
     ${where} ORDER BY a.created_at DESC LIMIT $3 OFFSET $4`, values
  );
  const total = count.rows[0].total;
  return { data: result.rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } };
}
