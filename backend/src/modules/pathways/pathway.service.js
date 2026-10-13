import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import {
  evaluateUserProgressAndEvidence,
  buildGenericCareerPathway,
  DOMAIN_PATHWAY_TEMPLATES
} from './pathway-engine.js';

export async function listUserPathways(userId) {
  const result = await pool.query(
    `SELECT up.id, up.pathway_id, up.title, up.status, up.created_at, up.updated_at,
            p.career_id, c.title AS career_title
     FROM user_pathways up
     JOIN pathways p ON p.id = up.pathway_id
     LEFT JOIN careers c ON c.id = p.career_id
     WHERE up.user_id = $1 AND up.status IN ('active', 'completed')
     ORDER BY up.updated_at DESC`, [userId]
  );
  return result.rows;
}

async function callAi(path, payload, timeoutMs = 8000) {
  if (!env.AI_SERVICE_URL) {
    logger.error('callAi failed: AI_SERVICE_URL is not set');
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'content-type': 'application/json' };
    if (env.INTERNAL_SERVICE_TOKEN) headers['x-internal-service-token'] = env.INTERNAL_SERVICE_TOKEN;
    const response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error(`callAi HTTP ${response.status}`, { path, text: text.substring(0, 500) });
      return null;
    }
    return await response.json();
  } catch (err) {
    logger.error(`callAi network/timeout error: ${err.message}`, { path, name: err.name });
    return null;
  } finally { clearTimeout(timeout); }
}

export async function listPathways({ page, limit, search, careerId }) {
  const offset = (page - 1) * limit;
  const values = [search, careerId ?? ''];
  const where = `WHERE p.record_status != 'archived' AND p.pathway_type = 'template'
    AND ($1 = '' OR p.title ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%')
    AND ($2 = '' OR p.career_id = NULLIF($2, '')::uuid)`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM pathways p ${where}`, values);
  values.push(limit, offset);
  const result = await pool.query(
    `SELECT p.id, p.career_id, c.title AS career_title, p.title, p.description,
            p.verification_status, p.source_url, p.source_document_url, p.verified_at
     FROM pathways p JOIN careers c ON c.id = p.career_id
     ${where} ORDER BY p.title LIMIT $3 OFFSET $4`, values
  );
  const total = count.rows[0].total;
  return { data: result.rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } };
}

export async function getPathway(pathwayId, userId = null) {
  const result = await pool.query(
    `SELECT p.id, p.career_id, c.title AS career_title, p.title, p.description,
            p.pathway_type, p.record_status, p.verification_status, p.source_url,
            p.source_document_url, p.source_last_checked_at, p.verified_at,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'id', ps.id, 'step_order', ps.step_order, 'title', ps.title,
              'description', ps.description, 'step_type', ps.step_type, 'metadata', ps.metadata
            ) ORDER BY ps.step_order) FROM pathway_steps ps WHERE ps.pathway_id = p.id), '[]'::jsonb) AS steps
     FROM pathways p JOIN careers c ON c.id = p.career_id
     WHERE p.id = $1 AND p.record_status != 'archived' AND p.pathway_type = 'template'`, [pathwayId]
  );
  if (!result.rows[0]) return null;
  const data = result.rows[0];
  if (userId) {
    const saved = await pool.query(
      `SELECT id FROM saved_items WHERE user_id = $1 AND item_type = 'pathway' AND item_id = $2`, [userId, pathwayId]
    );
    data.saved = Boolean(saved.rows[0]);
  }
  return data;
}

export async function generatePathway(userId, input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    if (!input.career_id) {
       const error = new Error('career_id is required.');
       error.statusCode = 400; error.code = 'VALIDATION_ERROR'; throw error;
    }

    let careerRes = await client.query('SELECT id, title, description, qualifications, entry_routes, responsibilities FROM careers WHERE id = $1', [input.career_id]);
    let careerRow = careerRes.rows[0];
    if (!careerRow) {
      const aiRes = await client.query('SELECT id, title, description, responsibilities, qualifications, entry_routes FROM ai_career_profiles WHERE id = $1', [input.career_id]);
      careerRow = aiRes.rows[0];
    }
    if (!careerRow) {
      const error = new Error('Career not found.');
      error.statusCode = 404; error.code = 'CAREER_NOT_FOUND'; throw error;
    }

    const enrichRes = await client.query('SELECT description, responsibilities, qualifications FROM career_enrichments WHERE career_id = $1', [input.career_id]);
    if (enrichRes.rows.length > 0) {
      const enrich = enrichRes.rows[0];
      careerRow.description = enrich.description || careerRow.description;
      if (enrich.responsibilities && enrich.responsibilities.length > 0) careerRow.responsibilities = enrich.responsibilities;
      if (enrich.qualifications && enrich.qualifications.length > 0) careerRow.qualifications = enrich.qualifications;
    }

    const profileRes = await client.query(
      `SELECT education, experience, interests, preferred_locations, career_goal, constraints
       FROM user_profiles WHERE user_id = $1`, [userId]
    );
    const profile = profileRes.rows[0] ?? {};

    const userSkillsRes = await client.query(
      `SELECT s.name FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = $1`, [userId]
    );
    const userSkills = userSkillsRes.rows.map(r => r.name);

    const customSkillsRes = await client.query(
      `SELECT name FROM user_custom_skills WHERE user_id = $1`, [userId]
    ).catch(() => ({ rows: [] }));
    const customSkills = customSkillsRes.rows.map(r => r.name);

    const careerSkillsRes = await client.query(
      `SELECT s.name, cs.importance FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1`, [input.career_id]
    );
    const requiredSkills = careerSkillsRes.rows;

    const matched = [];
    const missingRequired = [];
    const missingUseful = [];
    
    const userSet = new Set([...userSkills, ...customSkills].map(s => s.toLowerCase()));
    for (const sk of requiredSkills) {
      if (userSet.has(sk.name.toLowerCase())) {
        matched.push(sk.name);
      } else if (sk.importance === 'required' || sk.importance === 'important') {
        missingRequired.push(sk.name);
      } else {
        missingUseful.push(sk.name);
      }
    }

    // Call AI service with a safe timeout
    let aiRes = null;
    try {
      aiRes = await callAi('/internal/v1/pathways/generate_two', {
        career_context: {
          title: careerRow.title,
          description: careerRow.description || 'A professional career path.',
          responsibilities: careerRow.responsibilities || [],
          qualifications: careerRow.qualifications || [],
          entry_routes: careerRow.entry_routes || []
        },
        user_context: profile,
        skill_gap: { matched, missing_required: missingRequired, missing_useful: missingUseful }
      }, 8000);
    } catch (err) {
      logger.warn('AI pathway generation failed, falling back to deterministic engine:', err.message);
    }

    let pathwaysToInsert = [];

    // Use AI pathways if schema is valid
    if (aiRes && aiRes.status === 'ai_generated' && Array.isArray(aiRes.pathways) && aiRes.pathways.length >= 2) {
      pathwaysToInsert = aiRes.pathways;
    } else {
      // Deterministic Multi-Stage Engine Fallback
      logger.info('Using deterministic multi-stage pathway fallback for:', careerRow.title);
      const baseSteps = buildGenericCareerPathway(careerRow.title, careerRow);
      
      const pathway1Steps = baseSteps.map((s, idx) => ({
        order: idx + 1,
        title: s.title,
        description: s.what_to_do,
        step_type: s.step_type || 'skill',
        estimated_duration: s.estimated_duration,
        metadata: {
          stage: s.stage,
          stage_order: s.stage_order,
          why_it_matters: s.why_it_matters,
          what_to_do: s.what_to_do,
          prerequisites: s.prerequisites || [],
          deliverable: s.deliverable,
          action_link: s.action_link,
          action_label: s.action_label,
          estimated_duration: s.estimated_duration,
          is_optional: Boolean(s.is_optional),
          skills: s.skills || []
        }
      }));

      const pathway2Steps = baseSteps.map((s, idx) => {
        let altTitle = s.title;
        let altWhat = s.what_to_do;
        if (s.stage_order === 1) {
          altTitle = `Foundational Readiness & Core Concepts for ${careerRow.title}`;
        } else if (s.stage_order === 4) {
          altTitle = `Comprehensive Case Study & Methodological Analysis`;
          altWhat = `Conduct deep analytical case review and structured documentation for ${careerRow.title}.`;
        }
        return {
          order: idx + 1,
          title: altTitle,
          description: altWhat,
          step_type: s.step_type || 'education',
          estimated_duration: s.estimated_duration,
          metadata: {
            stage: s.stage,
            stage_order: s.stage_order,
            why_it_matters: s.why_it_matters,
            what_to_do: altWhat,
            prerequisites: s.prerequisites || [],
            deliverable: s.deliverable,
            action_link: s.action_link,
            action_label: s.action_label,
            estimated_duration: s.estimated_duration,
            is_optional: Boolean(s.is_optional),
            skills: s.skills || []
          }
        };
      });

      pathwaysToInsert = [
        {
          title: `${careerRow.title} — Project-Driven Practical Pathway`,
          summary: `Hands-on path emphasizing tangible project deliverables, portfolio code, and practical case studies.`,
          strategy: `Prioritize building real projects, solving domain problems, and assembling verified portfolio evidence.`,
          estimated_duration: `6-9 months`,
          steps: pathway1Steps
        },
        {
          title: `${careerRow.title} — Structured Learning & Specialization Pathway`,
          summary: `Rigorous academic and certification route covering theoretical principles, structured curriculum, and verified standards.`,
          strategy: `Focus on comprehensive conceptual foundations, formal learning milestones, and domain specialization.`,
          estimated_duration: `9-12 months`,
          steps: pathway2Steps
        }
      ];
    }

    const generatedUserPathways = [];
    const context = {
      generated_at: new Date().toISOString(),
      goal: input.goal ?? profile.career_goal ?? null,
      preferences: input.preferences ?? {}
    };

    for (const pw of pathwaysToInsert) {
      const pRes = await client.query(
        `INSERT INTO pathways (career_id, title, description, pathway_type, record_status, verification_status, origin)
         VALUES ($1, $2, $3, 'generated', 'published', 'unverified', 'ai_generated')
         RETURNING id, career_id, title, description, verification_status, origin`,
        [input.career_id, pw.title, pw.description || pw.summary || '']
      );
      const template = pRes.rows[0];
      template.steps = [];
      
      for (const step of pw.steps || []) {
        const meta = step.metadata || {
          stage: step.stage || `Stage ${step.order}`,
          deliverable: step.deliverable || 'Documented project artifact',
          action_link: step.action_link || '/skills/gap',
          action_label: step.action_label || 'View Skill Details',
          prerequisites: step.prerequisites || []
        };
        const sRes = await client.query(
          `INSERT INTO pathway_steps (pathway_id, step_order, title, description, step_type, verification_status, origin, metadata)
           VALUES ($1, $2, $3, $4, $5, 'unverified', 'ai_generated', $6)
           RETURNING id, step_order, title, description, step_type, metadata`,
          [template.id, step.order, step.title, step.description || '', step.step_type || 'skill', JSON.stringify(meta)]
        );
        template.steps.push(sRes.rows[0]);
      }

      const upContext = { ...context, strategy: pw.strategy, estimated_duration: pw.estimated_duration };
      const userPathway = await client.query(
        `INSERT INTO user_pathways (user_id, pathway_id, title, generated_context, status)
         VALUES ($1, $2, $3, $4, 'generated') RETURNING id, user_id, pathway_id, title, status, generated_context, created_at, updated_at`,
        [userId, template.id, pw.title, JSON.stringify(upContext)]
      );
      
      for (const step of template.steps) {
        await client.query(
          `INSERT INTO user_pathway_steps (user_pathway_id, pathway_step_id) VALUES ($1, $2)`,
          [userPathway.rows[0].id, step.id]
        );
      }

      // Evaluate personalized progress
      const userProjectsRes = await pool.query(
        `SELECT id, career_id, career_title, title, status, COALESCE(skills, skills_exercised, '[]'::jsonb) AS skills FROM user_projects WHERE user_id = $1`, [userId]
      ).catch(() => ({ rows: [] }));
      const userProjects = userProjectsRes.rows;
      const userContext = { profile, user_skills: userSkills, custom_skills: customSkills, user_projects: userProjects };
      const evaluated = evaluateUserProgressAndEvidence(userContext, template.steps.map(s => ({ ...s, status: 'not_started' })), careerRow.title);

      generatedUserPathways.push({
        ...userPathway.rows[0],
        career_title: careerRow.title,
        steps: evaluated.steps,
        metrics: evaluated.metrics,
        starting_point: evaluated.starting_point,
        experience_tier: evaluated.experience_tier
      });
    }

    await client.query('COMMIT');
    return generatedUserPathways;
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
}

export async function selectPathway(userId, userPathwayId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(`SELECT id, status, generated_context FROM user_pathways WHERE id = $1 AND user_id = $2 FOR UPDATE`, [userPathwayId, userId]);
    if (res.rows.length === 0) throw new Error('Not found');
    const row = res.rows[0];
    if (row.status !== 'generated') {
       await client.query('COMMIT');
       return await getUserPathway(userId, userPathwayId);
    }
    
    // Find the other generated pathway from the same batch
    if (row.generated_context && row.generated_context.generated_at) {
       await client.query(`UPDATE user_pathways SET status = 'archived' WHERE user_id = $1 AND status = 'generated' AND generated_context->>'generated_at' = $2 AND id != $3`, [userId, row.generated_context.generated_at, userPathwayId]);
    }

    await client.query(`UPDATE user_pathways SET status = 'active', updated_at = NOW() WHERE id = $1`, [userPathwayId]);
    await client.query('COMMIT');
    return await getUserPathway(userId, userPathwayId);
  } catch (err) {
    await client.query('ROLLBACK');
    return null;
  } finally {
    client.release();
  }
}

export async function getUserPathway(userId, userPathwayId) {
  const result = await pool.query(
    `SELECT up.id, up.user_id, up.pathway_id, up.title, up.status, up.generated_context,
            up.created_at, up.updated_at, p.career_id, c.title AS career_title,
            COALESCE(jsonb_agg(jsonb_build_object(
              'id', ups.id, 'pathway_step_id', ups.pathway_step_id, 'step_order', ps.step_order,
              'title', ps.title, 'description', ps.description, 'step_type', ps.step_type,
              'status', ups.status, 'started_at', ups.started_at, 'completed_at', ups.completed_at,
              'notes', ups.notes, 'metadata', ps.metadata
            ) ORDER BY ps.step_order) FILTER (WHERE ups.id IS NOT NULL), '[]'::jsonb) AS raw_steps
     FROM user_pathways up JOIN pathways p ON p.id = up.pathway_id
     JOIN careers c ON c.id = p.career_id
     LEFT JOIN user_pathway_steps ups ON ups.user_pathway_id = up.id
     LEFT JOIN pathway_steps ps ON ps.id = ups.pathway_step_id
     WHERE up.user_id = $2 AND (up.id = $1 OR up.pathway_id = $1)
     GROUP BY up.id, p.id, c.id ORDER BY up.updated_at DESC LIMIT 1`, [userPathwayId, userId]
  );
  if (!result.rows[0]) return null;
  const rawRow = result.rows[0];

  // Fetch user profile and skills to evaluate evidence and auto-detect completion
  const profileRes = await pool.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]);
  const profile = profileRes.rows[0] ?? {};

  const userSkillsRes = await pool.query(
    `SELECT s.name, us.level AS proficiency, us.verified FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = $1`, [userId]
  );
  const userSkills = userSkillsRes.rows;

  const customSkillsRes = await pool.query(
    `SELECT name FROM user_custom_skills WHERE user_id = $1`, [userId]
  ).catch(() => ({ rows: [] }));
  const customSkills = customSkillsRes.rows;

  const userProjectsRes = await pool.query(
    `SELECT id, career_id, career_title, title, status, COALESCE(skills, skills_exercised, '[]'::jsonb) AS skills FROM user_projects WHERE user_id = $1`, [userId]
  ).catch(() => ({ rows: [] }));
  const userProjects = userProjectsRes.rows;

  const userContext = { profile, user_skills: userSkills, custom_skills: customSkills, user_projects: userProjects };
  const evaluated = evaluateUserProgressAndEvidence(userContext, rawRow.raw_steps || [], rawRow.career_title);

  return {
    id: rawRow.id,
    user_id: rawRow.user_id,
    pathway_id: rawRow.pathway_id,
    title: rawRow.title,
    status: rawRow.status,
    career_id: rawRow.career_id,
    career_title: rawRow.career_title,
    generated_context: rawRow.generated_context,
    created_at: rawRow.created_at,
    updated_at: rawRow.updated_at,
    steps: evaluated.steps,
    metrics: evaluated.metrics,
    starting_point: evaluated.starting_point,
    experience_tier: evaluated.experience_tier
  };
}

export async function selectTemplatePathway(userId, pathwayId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const pRes = await client.query(
      `SELECT id, career_id, title FROM pathways WHERE id = $1 AND pathway_type = 'template' AND record_status != 'archived'`,
      [pathwayId]
    );
    if (!pRes.rows[0]) throw new Error('Template pathway not found');
    const template = pRes.rows[0];

    // Archive any other active user pathways for this career (preserves milestone history)
    await client.query(
      `UPDATE user_pathways SET status = 'archived', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active' AND pathway_id IN (
         SELECT id FROM pathways WHERE career_id = $2
       )`,
      [userId, template.career_id]
    );

    // Check if the user already has an assignment for this exact template
    const existingRes = await client.query(
      `SELECT id, status FROM user_pathways WHERE user_id = $1 AND pathway_id = $2 ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
      [userId, template.id]
    );

    let userPathwayId;
    if (existingRes.rows.length > 0) {
      userPathwayId = existingRes.rows[0].id;
      // Reactivate existing assignment, preserving past progress and milestone records
      await client.query(
        `UPDATE user_pathways SET status = 'active', updated_at = NOW() WHERE id = $1`,
        [userPathwayId]
      );
    } else {
      const upRes = await client.query(
        `INSERT INTO user_pathways (user_id, pathway_id, title, status)
         VALUES ($1, $2, $3, 'active') RETURNING id`,
        [userId, template.id, template.title]
      );
      userPathwayId = upRes.rows[0].id;

      // Insert steps into user_pathway_steps
      const stepsRes = await client.query(
        `SELECT ps.id, ps.title, ps.description, ps.step_order, ps.metadata
         FROM pathway_steps ps WHERE ps.pathway_id = $1 ORDER BY ps.step_order`,
        [template.id]
      );
      
      // Check user profile for auto-detected completion on creation
      const profileRes = await client.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]);
      const profile = profileRes.rows[0] ?? {};
      const userSkillsRes = await client.query(
        `SELECT s.name FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = $1`, [userId]
      );
      const userSkills = userSkillsRes.rows;

      const userProjectsRes = await pool.query(
        `SELECT id, career_id, career_title, title, status, COALESCE(skills, skills_exercised, '[]'::jsonb) AS skills FROM user_projects WHERE user_id = $1`, [userId]
      ).catch(() => ({ rows: [] }));
      const userProjects = userProjectsRes.rows;

      const evaluated = evaluateUserProgressAndEvidence(
        { profile, user_skills: userSkills, custom_skills: [], user_projects: userProjects },
        stepsRes.rows.map(s => ({ ...s, status: 'not_started' })),
        template.title
      );

      for (const step of evaluated.steps) {
        const isAuto = step.status === 'completed' && (step.completion_source === 'auto_detected' || step.completion_source === 'project_completed');
        await client.query(
          `INSERT INTO user_pathway_steps (user_pathway_id, pathway_step_id, status, notes, completed_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userPathwayId,
            step.id,
            isAuto ? 'completed' : 'not_started',
            isAuto ? (step.auto_evidence || 'Auto-detected from profile evidence') : null,
            isAuto ? new Date() : null
          ]
        );
      }
    }
    
    await client.query('COMMIT');
    return await getUserPathway(userId, userPathwayId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getCareerPathways(userId, careerId) {
  // 1. Get existing database reference pathways
  const dbPathwaysRes = await pool.query(
    `SELECT p.id, p.career_id, c.title AS career_title, p.title, p.description,
            p.verification_status, p.origin, p.source_url, p.source_document_url, p.verified_at,
            (
              SELECT COALESCE(json_agg(row_to_json(ps.*)), '[]'::json)
              FROM (SELECT * FROM pathway_steps ps2 WHERE ps2.pathway_id = p.id ORDER BY step_order) ps
            ) as steps
     FROM pathways p JOIN careers c ON c.id = p.career_id
     WHERE p.career_id = $1 AND p.record_status != 'archived' AND p.pathway_type = 'template'
     ORDER BY CASE WHEN p.record_status = 'published' THEN 0 ELSE 1 END, p.title`,
    [careerId]
  );
  
  // Deduplicate near-duplicate database templates based on title and step signatures
  const deduplicatedExisting = [];
  const seenTemplateTitles = new Set();
  const seenStepSignatures = new Set();

  for (const pw of dbPathwaysRes.rows) {
    const normTitle = (pw.title || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().replace(/\s+/g, ' ');
    const stepSig = Array.isArray(pw.steps) && pw.steps.length > 0
      ? pw.steps.map(s => (s.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)).sort().join('|')
      : '';

    if (seenTemplateTitles.has(normTitle)) continue;
    if (stepSig && seenStepSignatures.has(stepSig)) continue;

    seenTemplateTitles.add(normTitle);
    if (stepSig) seenStepSignatures.add(stepSig);
    deduplicatedExisting.push({
      ...pw,
      is_database_backed: true,
      origin: pw.origin || 'curated'
    });
  }

  // 2. Get user pathways for this career (both AI-generated and selected DB pathways)
  const userPathwaysRes = await pool.query(
    `SELECT up.id, up.user_id, up.pathway_id, up.title, up.status, up.generated_context,
            up.created_at, up.updated_at, p.career_id, c.title AS career_title, p.origin, p.pathway_type
     FROM user_pathways up JOIN pathways p ON p.id = up.pathway_id
     JOIN careers c ON c.id = p.career_id
     WHERE up.user_id = $1 AND p.career_id = $2 AND up.status != 'archived'
     ORDER BY up.updated_at DESC`,
    [userId, careerId]
  );

  let selected = null;
  const aiGenerated = [];
  let latestBatchTimestamp = null;

  for (const row of userPathwaysRes.rows) {
    if (row.status === 'active' || row.status === 'completed') {
      if (!selected) {
        selected = await getUserPathway(userId, row.id);
      }
    } else if (row.status === 'generated' && row.pathway_type === 'generated' && row.origin === 'ai_generated') {
      const genAt = row.generated_context?.generated_at;
      if (!latestBatchTimestamp && genAt) {
        latestBatchTimestamp = genAt;
      }
      // Only include pathways from the latest generation batch (up to 2 strategies)
      if (!latestBatchTimestamp || genAt === latestBatchTimestamp) {
        if (aiGenerated.length < 2) {
          const fullGen = await getUserPathway(userId, row.id);
          if (fullGen) {
            aiGenerated.push({
              ...fullGen,
              is_database_backed: false,
              origin: 'ai_generated'
            });
          }
        }
      }
    }
  }

  return {
    existing: deduplicatedExisting,
    aiGenerated: aiGenerated,
    selected: selected
  };
}

export async function updateProgress(userId, userPathwayId, steps) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owner = await client.query('SELECT id FROM user_pathways WHERE user_id = $2 AND (id = $1 OR pathway_id = $1) ORDER BY updated_at DESC LIMIT 1 FOR UPDATE', [userPathwayId, userId]);
    if (!owner.rows[0]) {
      const error = new Error('Personalized pathway not found.'); error.statusCode = 404; error.code = 'USER_PATHWAY_NOT_FOUND'; throw error;
    }
    const actualUserPathwayId = owner.rows[0].id;
    for (const item of steps) {
      const stepIdentifier = item.pathway_step_id || item.step_id || item.id;
      const exists = await client.query(
        'SELECT id, pathway_step_id FROM user_pathway_steps WHERE user_pathway_id = $1 AND (pathway_step_id = $2 OR id = $2)',
        [actualUserPathwayId, stepIdentifier]
      );
      if (!exists.rows[0]) {
        const error = new Error('One or more pathway steps do not belong to this personalized pathway.');
        error.statusCode = 400;
        error.code = 'INVALID_PATHWAY_STEP';
        throw error;
      }
      const matchedPathwayStepId = exists.rows[0].pathway_step_id;
      
      let startedAtSql = 'NULL';
      let completedAtSql = 'NULL';
      if (item.status === 'completed') {
        startedAtSql = 'COALESCE(started_at, NOW())';
        completedAtSql = 'NOW()';
      } else if (item.status === 'in_progress') {
        startedAtSql = 'NOW()';
        completedAtSql = 'NULL';
      } else if (item.status === 'skipped') {
        startedAtSql = 'NULL';
        completedAtSql = 'NULL';
      } else {
        startedAtSql = 'NULL';
        completedAtSql = 'NULL';
      }

      await client.query(
        `UPDATE user_pathway_steps SET status = $1, notes = $2,
           started_at = ${startedAtSql}, completed_at = ${completedAtSql}
         WHERE user_pathway_id = $3 AND (pathway_step_id = $4 OR id = $4)`,
        [item.status, item.notes ?? null, actualUserPathwayId, stepIdentifier]
      );
    }
    const counts = await client.query(
      `SELECT COUNT(*)::int AS total, 
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
              COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped
       FROM user_pathway_steps WHERE user_pathway_id = $1`, [actualUserPathwayId]
    );
    const complete = counts.rows[0].total > 0 && (counts.rows[0].completed + counts.rows[0].skipped) === counts.rows[0].total;
    await client.query('UPDATE user_pathways SET status = $1, updated_at = NOW() WHERE id = $2', [complete ? 'completed' : 'active', actualUserPathwayId]);
    await client.query('COMMIT');
    return getUserPathway(userId, actualUserPathwayId);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function skipStep(userId, userPathwayId, stepId) {
  return updateProgress(userId, userPathwayId, [
    { pathway_step_id: stepId, status: 'skipped', notes: 'Skipped by user' }
  ]);
}

export async function undoStep(userId, userPathwayId, stepId) {
  return updateProgress(userId, userPathwayId, [
    { pathway_step_id: stepId, status: 'not_started', notes: null }
  ]);
}

export async function completeStep(userId, userPathwayId, stepId, notes = null) {
  return updateProgress(userId, userPathwayId, [
    { pathway_step_id: stepId, status: 'completed', notes }
  ]);
}

export async function completePathway(userId, userPathwayId, options = {}) {
  const stepId = options.stepId || options.step_id || options.milestoneId || options.milestone_id || null;
  const notes = options.notes ?? null;

  if (stepId) {
    return completeStep(userId, userPathwayId, stepId, notes);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owner = await client.query(
      'SELECT id, status FROM user_pathways WHERE user_id = $2 AND (id = $1 OR pathway_id = $1) ORDER BY updated_at DESC LIMIT 1 FOR UPDATE',
      [userPathwayId, userId]
    );
    if (!owner.rows[0]) {
      const error = new Error('Personalized pathway not found.');
      error.statusCode = 404;
      error.code = 'USER_PATHWAY_NOT_FOUND';
      throw error;
    }
    const actualUserPathwayId = owner.rows[0].id;

    await client.query(
      `UPDATE user_pathway_steps 
       SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW() 
       WHERE user_pathway_id = $1 AND status != 'completed'`,
      [actualUserPathwayId]
    );

    await client.query(
      `UPDATE user_pathways SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [actualUserPathwayId]
    );

    await client.query('COMMIT');
    return getUserPathway(userId, actualUserPathwayId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveUserPathway(userId, userPathwayId) {
  if (!userPathwayId) return false;

  // 1. Direct match on user_pathways assignment PK
  const assignmentRes = await pool.query(
    'SELECT id, user_id, status, pathway_id FROM user_pathways WHERE id = $1',
    [userPathwayId]
  );

  if (assignmentRes.rows.length > 0) {
    const assignment = assignmentRes.rows[0];

    // Ownership check: must belong to the authenticated user
    if (assignment.user_id !== userId) {
      const error = new Error('You do not have permission to remove this pathway assignment.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Already archived: treat as already removed
    if (assignment.status === 'archived') {
      return false;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "UPDATE user_pathways SET status = 'archived', updated_at = NOW() WHERE id = $1 AND user_id = $2",
        [assignment.id, userId]
      );
      await client.query(
        "DELETE FROM saved_items WHERE user_id = $1 AND item_type = 'pathway' AND (item_id = $2 OR item_id = $3)",
        [userId, assignment.pathway_id, assignment.id]
      );
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // 2. Fallback: match by template pathway_id for this user (if active or completed)
  const templateAssignmentRes = await pool.query(
    `SELECT id, user_id, status, pathway_id FROM user_pathways
     WHERE user_id = $1 AND pathway_id = $2 AND status != 'archived'
     ORDER BY updated_at DESC LIMIT 1`,
    [userId, userPathwayId]
  );

  if (templateAssignmentRes.rows.length > 0) {
    const assignment = templateAssignmentRes.rows[0];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "UPDATE user_pathways SET status = 'archived', updated_at = NOW() WHERE id = $1 AND user_id = $2",
        [assignment.id, userId]
      );
      await client.query(
        "DELETE FROM saved_items WHERE user_id = $1 AND item_type = 'pathway' AND (item_id = $2 OR item_id = $3)",
        [userId, assignment.pathway_id, assignment.id]
      );
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // 3. Fallback: match by career_id for this user (if active or completed)
  const careerAssignmentRes = await pool.query(
    `SELECT up.id, up.user_id, up.status, up.pathway_id
     FROM user_pathways up
     JOIN pathways p ON p.id = up.pathway_id
     WHERE up.user_id = $1 AND p.career_id = $2 AND up.status != 'archived'
     ORDER BY up.updated_at DESC LIMIT 1`,
    [userId, userPathwayId]
  );

  if (careerAssignmentRes.rows.length > 0) {
    const assignment = careerAssignmentRes.rows[0];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "UPDATE user_pathways SET status = 'archived', updated_at = NOW() WHERE id = $1 AND user_id = $2",
        [assignment.id, userId]
      );
      await client.query(
        "DELETE FROM saved_items WHERE user_id = $1 AND item_type = 'pathway' AND (item_id = $2 OR item_id = $3)",
        [userId, assignment.pathway_id, assignment.id]
      );
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return false;
}

export async function savePathway(userId, pathwayId) {
  const pathway = await pool.query(`SELECT id FROM pathways WHERE id = $1 AND record_status = 'published' AND pathway_type = 'template'`, [pathwayId]);
  if (!pathway.rows[0]) return false;
  await pool.query(
    `INSERT INTO saved_items (user_id, item_type, item_id) VALUES ($1, 'pathway', $2) ON CONFLICT (user_id, item_type, item_id) DO NOTHING`, [userId, pathwayId]
  );
  return true;
}

export async function unsavePathway(userId, pathwayId) {
  const result = await pool.query(`DELETE FROM saved_items WHERE user_id = $1 AND item_type = 'pathway' AND item_id = $2 RETURNING id`, [userId, pathwayId]);
  return Boolean(result.rows[0]);
}
